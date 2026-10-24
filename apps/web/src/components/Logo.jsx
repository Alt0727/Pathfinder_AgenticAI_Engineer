/*
  Logo
  The unmute mark + wordmark for the nav bar: the bone "U" with three bars
  (signal orange, sage, teal) and "un" in bold with "mute" in light grey.

  Props:
    className: optional extra classes

  Needs: unmute.css (.font-brand)
*/
export function Logo({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 120 120" className="size-8" aria-hidden="true">
        <path d="M24 18 V66 A36 36 0 0 0 96 66 V18" fill="none" stroke="#f3efe6" strokeWidth="13" />
        <rect x="40" y="40" width="26" height="9" fill="#f28a3c" />
        <rect x="40" y="55" width="34" height="9" fill="#bcc9be" />
        <rect x="40" y="70" width="18" height="9" fill="#4fc9b4" />
      </svg>
      <span className="font-brand text-[25px] leading-none tracking-[-0.05em]">
        <span className="font-bold">un</span>
        <span className="font-light text-muted-foreground">mute</span>
      </span>
    </span>
  )
}
