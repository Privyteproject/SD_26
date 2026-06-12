export default function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <circle cx="17" cy="17" r="4.2" fill="var(--gold)" />
      <circle cx="7" cy="8" r="2.4" fill="var(--gold-deep)" />
      <circle cx="27" cy="9" r="2.4" fill="var(--gold)" />
      <circle cx="8" cy="26" r="2.4" fill="var(--gold)" />
      <circle cx="26" cy="26" r="2.4" fill="var(--gold-deep)" />
      <path
        d="M17 17 L7 8 M17 17 L27 9 M17 17 L8 26 M17 17 L26 26"
        stroke="var(--gold)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
