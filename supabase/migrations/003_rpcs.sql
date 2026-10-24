-- 003_rpcs.sql: shared logic used by the web app AND the agent (spec: unmute-schema.md → RPCs).
-- security invoker = the function runs with the caller's rights, so RLS still applies:
-- a signed-in user passing someone else's p_user gets nothing back. The agent (secret key) can
-- pass any p_user. All times are IST (Asia/Kolkata).

-- ---------- get_week: timetable expanded to real dates + overrides + plan entries ----------
create or replace function get_week(p_user uuid, p_from date, p_to date)
returns table (
  id uuid, title text, starts_at timestamptz, ends_at timestamptz,
  source text, placed_by text, slot_id uuid, card_id uuid,
  end_estimated boolean, card_status text
)
language sql stable security invoker set search_path = public
as $$
  with bounds as (
    select (p_from::timestamp at time zone 'Asia/Kolkata')       as t_from,
           ((p_to + 1)::timestamp at time zone 'Asia/Kolkata')   as t_to
  ),
  -- 7 extra days each side so a slot moved INTO this range from a nearby date still shows up
  days as (
    select d::date as day
    from generate_series(p_from - 7, p_to + 7, interval '1 day') as d
  ),
  occurrences as (
    select s.id as slot_id, s.label, d.day,
           (d.day + s.start_time) at time zone 'Asia/Kolkata' as starts_at,
           (d.day + s.end_time)   at time zone 'Asia/Kolkata' as ends_at
    from timetable_slots s
    join days d on extract(dow from d.day) = s.day_of_week   -- 0 = Sunday on both sides
    where s.user_id = p_user
  ),
  items as (
    -- timetable rows: cancel → dropped, move → that date's new times
    select o.slot_id as id, o.label as title,
           coalesce(ov.starts_at, o.starts_at) as starts_at,
           coalesce(ov.ends_at, o.ends_at)     as ends_at,
           'timetable'::text as source, null::text as placed_by,
           o.slot_id, null::uuid as card_id, false as end_estimated, null::text as card_status
    from occurrences o
    left join timetable_overrides ov on ov.slot_id = o.slot_id and ov.date = o.day
    where ov.action is distinct from 'cancel'

    union all

    -- plan rows (not cancelled); card_status lets the UI strike through cancelled cards
    select e.id, e.title, e.starts_at, e.ends_at,
           'plan'::text, e.placed_by,
           null::uuid, e.card_id, e.end_estimated, c.status
    from plan_entries e
    left join cards c on c.id = e.card_id
    where e.user_id = p_user and e.status <> 'cancelled'
  )
  select i.*
  from items i, bounds b
  where i.starts_at < b.t_to and i.ends_at > b.t_from    -- overlaps [p_from, p_to] in IST
  order by i.starts_at;
$$;

-- ---------- check_clash: everything in get_week that overlaps [p_starts, p_ends) ----------
create or replace function check_clash(
  p_user uuid, p_starts timestamptz, p_ends timestamptz, p_ignore uuid default null
)
returns table (
  id uuid, title text, starts_at timestamptz, ends_at timestamptz,
  source text, placed_by text, slot_id uuid, card_id uuid,
  end_estimated boolean, card_status text
)
language sql stable security invoker set search_path = public
as $$
  select w.*
  from get_week(
         p_user,
         (p_starts at time zone 'Asia/Kolkata')::date,
         (p_ends   at time zone 'Asia/Kolkata')::date
       ) as w
  where w.starts_at < p_ends and p_starts < w.ends_at       -- a.starts < b.ends and b.starts < a.ends
    and (p_ignore is null or w.id <> p_ignore);              -- e.g. the entry being moved
$$;

-- ---------- get_feed: ranked cards + a "why" (formula: unmute-functions.md → Feed ranking) ----------
-- score = interest + participation + urgency + priority + saved
create or replace function get_feed(p_user uuid, p_limit int default 50)
returns table (
  id uuid, type text, title text, summary text, tags text[],
  deadline_at timestamptz, starts_at timestamptz, ends_at timestamptz,
  location text, link text, source_group_name text,
  score numeric, why text
)
language sql stable security invoker set search_path = public
as $$
  with me as (
    select coalesce((select p.interests from profiles p where p.id = p_user), '{}'::text[]) as interests
  ),
  -- weight of each added/skipped card in the last 90 days: 0.5^(days_ago/30)
  history as (
    select ca.action, c.tags,
           power(0.5, extract(epoch from now() - ca.created_at) / 86400 / 30)::numeric as w
    from card_actions ca
    join cards c on c.id = ca.card_id
    where ca.user_id = p_user
      and ca.action in ('added', 'skipped')
      and ca.created_at > now() - interval '90 days'
  ),
  -- per tag: added − 0.5 × skipped
  affinity as (
    select t.tag, sum(case when h.action = 'added' then h.w else -0.5 * h.w end) as score
    from history h
    cross join lateral unnest(h.tags) as t(tag)
    group by t.tag
  ),
  -- active, not past, not already added/skipped (saved cards stay and get +1)
  candidates as (
    select c.*, (ca.action = 'saved') as is_saved,
           coalesce(case when c.deadline_at > now() then c.deadline_at end,
                    case when c.starts_at   > now() then c.starts_at end) as target
    from cards c
    left join card_actions ca on ca.card_id = c.id and ca.user_id = p_user
    where c.status = 'active'
      and (greatest(c.deadline_at, c.starts_at, c.ends_at) is null
           or greatest(c.deadline_at, c.starts_at, c.ends_at) > now())
      and (ca.action is null or ca.action = 'saved')
  ),
  parts as (
    select c.*, bt.tag as best_tag,
      (case when c.tags && (select m.interests from me m) then 3 else 0 end)::numeric as interest,
      greatest(-2, least(4, coalesce(bt.score, 0)))                                  as participation,
      (case when c.target is null                         then 0
            when c.target - now() < interval '24 hours'   then 4
            when c.target - now() < interval '48 hours'   then 2.5
            when c.target - now() < interval '7 days'     then 1
            else 0 end)::numeric                                                     as urgency,
      (case when c.tags && array['placement', 'academic'] then 2 else 0 end)::numeric as priority,
      (case when c.is_saved then 1 else 0 end)::numeric                              as saved
    from candidates c
    -- the card's best tag by affinity (tags with no history count as 0)
    left join lateral (
      select t.tag, coalesce(a.score, 0) as score
      from unnest(c.tags) as t(tag)
      left join affinity a on a.tag = t.tag
      order by 2 desc
      limit 1
    ) bt on true
  )
  select p.id, p.type, p.title, p.summary, p.tags,
         p.deadline_at, p.starts_at, p.ends_at,
         p.location, p.link, p.source_group_name,
         round(p.interest + p.participation + p.urgency + p.priority + p.saved, 2) as score,
         -- "why" chip: the two largest positive parts
         coalesce((
           select string_agg(x.label, ' · ' order by x.v desc)
           from (
             select v, label
             from (values
               (p.interest,      'matches your interests'),
               (p.participation, 'you often add ' || coalesce(p.best_tag, 'these')),
               (p.urgency,       case when p.urgency = 4   then 'due in under 24 h'
                                      when p.urgency = 2.5 then 'due in under 48 h'
                                      else 'this week' end),
               (p.priority,      case when 'placement' = any(p.tags) then 'placement' else 'academic' end),
               (p.saved,         'you saved this')
             ) as part(v, label)
             where v > 0
             order by v desc
             limit 2
           ) x
         ), 'new') as why
  from parts p
  order by score desc, coalesce(p.deadline_at, p.starts_at) asc nulls last   -- ties → soonest
  limit p_limit;
$$;

-- Only signed-in users (and the service key) may call these.
revoke execute on function get_week(uuid, date, date) from public, anon;
revoke execute on function check_clash(uuid, timestamptz, timestamptz, uuid) from public, anon;
revoke execute on function get_feed(uuid, int) from public, anon;
grant execute on function get_week(uuid, date, date) to authenticated, service_role;
grant execute on function check_clash(uuid, timestamptz, timestamptz, uuid) to authenticated, service_role;
grant execute on function get_feed(uuid, int) to authenticated, service_role;
