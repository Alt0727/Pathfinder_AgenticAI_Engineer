/*
  Footer
  "MUTE THE GROUPS, NOT THE OPPORTUNITIES."  ·  "TEAM PATHFINDER · 2026"
  and the giant "UNMUTE" wordmark, fading from sage into the background.
  (The spec crops the wordmark's bottom with translateY(14%); it's kept whole here.)

  Props:
    team: optional team name (default "Team Pathfinder")

  Needs: unmute.css (.eyebrow, .font-display)
*/
export function Footer({ team = "Team Pathfinder" }) {
  return (
    <footer className="mt-24 overflow-hidden border-t">
      <div className="eyebrow mx-auto flex max-w-[1440px] flex-wrap justify-between gap-3 px-5 pt-8 sm:px-10">
        <span>Mute the groups, not the opportunities.</span>
        <span>
          {team} · {new Date().getFullYear()}
        </span>
      </div>
      <p
        aria-hidden="true"
        className="font-display bg-[linear-gradient(180deg,rgba(188,201,190,0.55),rgba(188,201,190,0.02)_85%)] bg-clip-text pb-[0.04em] text-center text-[clamp(120px,20vw,300px)] leading-[0.9] font-black tracking-normal text-transparent select-none"
      >
        unmute
      </p>
    </footer>
  )
}
