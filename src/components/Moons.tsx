/** The red moon Samer and the small blue moon Damini (Players Overview). */
export function Moons({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9.5" cy="12.5" r="7" stroke="#D9654B" strokeWidth="1.6" />
      <circle cx="9.5" cy="12.5" r="1.6" stroke="#D9654B" strokeWidth="1.2" />
      <circle cx="19" cy="6" r="2.4" stroke="#8FB1E6" strokeWidth="1.4" />
    </svg>
  );
}
