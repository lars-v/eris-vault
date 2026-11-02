/**
 * Spires against the prasinus-lime sky with the red moon Samer (one round crater) and the small blue
 * moon Damini (Players Overview p. 1; Gazetteer p. 5 and cover). Same art as src/app/icon.svg.
 * The ids are fixed: every copy on a page defines identical gradients, so sharing them is harmless.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="eris-logo-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9DB352" />
          <stop offset="1" stopColor="#D2DE8C" />
        </linearGradient>
        <radialGradient id="eris-logo-samer" cx=".62" cy=".32" r=".8">
          <stop offset="0" stopColor="#F29A7E" />
          <stop offset=".45" stopColor="#D9654B" />
          <stop offset="1" stopColor="#8E3626" />
        </radialGradient>
        <radialGradient id="eris-logo-damini" cx=".62" cy=".32" r=".8">
          <stop offset="0" stopColor="#C9DBF6" />
          <stop offset="1" stopColor="#6A8FC8" />
        </radialGradient>
        <clipPath id="eris-logo-disc">
          <circle cx="12" cy="12" r="11.5" />
        </clipPath>
      </defs>
      <g clipPath="url(#eris-logo-disc)">
        <rect width="24" height="24" fill="url(#eris-logo-sky)" />
        <circle cx="5.6" cy="8" r="3" fill="url(#eris-logo-samer)" />
        <circle cx="4.9" cy="7.2" r=".85" fill="#9C3E2B" />
        <circle cx="12.3" cy="4.6" r="1.1" fill="url(#eris-logo-damini)" />
        <g fill="#0F100D">
          <path d="M8.2 24V9.6l1.3-4.4 1.3 4.4V24z" />
          <path d="M14.3 24V12.4l.7-3.9.7 3.9V24z" />
          <path d="M16.6 24V10.4l.9-5.6.9 5.6V24z" />
          <path d="M19.4 24v-9.6l.6-3 .6 3V24z" />
          <path d="M0 19.4q3.2-2.6 6.4-.9 3.8-1.2 7 .2 5-1.5 10.6.1V24H0z" />
        </g>
      </g>
      <circle cx="12" cy="12" r="11.5" fill="none" stroke="#0F100D" strokeOpacity=".35" strokeWidth=".5" />
    </svg>
  );
}
