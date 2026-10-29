// The Hivecast queen and king bee, drawn in thin gold lines.
export function RoyalBees() {
  return (
    <svg className="royals" viewBox="0 0 140 80" aria-hidden="true" fill="none" stroke="#D4AF5A" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <g transform="translate(36 46)">
        <path d="M-9 -27 l3 -7 3 5 3 -6 3 6 3 -5 3 7 z" fill="#D4AF5A" fillOpacity={0.9} />
        <ellipse cx="-13" cy="-12" rx="11" ry="6" transform="rotate(-25 -13 -12)" fill="#D4AF5A" fillOpacity={0.12} />
        <ellipse cx="13" cy="-12" rx="11" ry="6" transform="rotate(25 13 -12)" fill="#D4AF5A" fillOpacity={0.12} />
        <circle cx="0" cy="-18" r="6" />
        <ellipse cx="0" cy="4" rx="9" ry="15" />
        <path d="M-8.6 -1h17.2M-8.8 5h17.6M-7.4 11h14.8" />
        <path d="M0 19v4" />
      </g>
      <g transform="translate(104 46)">
        <path d="M-10 -26 v-8 l5 4 5 -6 5 6 5 -4 v8 z" fill="#D4AF5A" fillOpacity={0.9} />
        <ellipse cx="-14" cy="-11" rx="12" ry="6.5" transform="rotate(-25 -14 -11)" fill="#D4AF5A" fillOpacity={0.12} />
        <ellipse cx="14" cy="-11" rx="12" ry="6.5" transform="rotate(25 14 -11)" fill="#D4AF5A" fillOpacity={0.12} />
        <circle cx="0" cy="-18" r="6.5" />
        <ellipse cx="0" cy="4" rx="10" ry="15" />
        <path d="M-9.6 -1h19.2M-9.8 5h19.6M-8.2 11h16.4" />
      </g>
    </svg>
  );
}
