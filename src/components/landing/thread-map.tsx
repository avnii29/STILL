export function ThreadMap() {
  return (
    <svg
      viewBox="0 0 720 420"
      className="mt-12 w-full max-w-3xl"
      role="img"
      aria-label="A quiet map of people and unfinished threads. Resolved lines fade. Active lines stay."
    >
      <rect width="720" height="420" fill="transparent" />
      <path
        d="M120 210 C200 160 260 280 340 220"
        fill="none"
        stroke="#c9c0b1"
        strokeWidth="1.2"
        opacity="0.45"
      />
      <path
        d="M340 220 C420 150 480 260 600 190"
        fill="none"
        stroke="#3f7f86"
        strokeWidth="1.6"
      />
      <path
        d="M340 220 C360 300 250 340 180 320"
        fill="none"
        stroke="#3f7f86"
        strokeWidth="1.4"
      />
      <path
        d="M180 320 C280 360 430 370 520 330"
        fill="none"
        stroke="#c9c0b1"
        strokeWidth="1.2"
        opacity="0.35"
      />
      <circle cx="120" cy="210" r="11" fill="#f7f3ea" stroke="#d8cfc0" />
      <circle cx="340" cy="220" r="16" fill="#f7f3ea" stroke="#3f7f86" />
      <circle cx="600" cy="190" r="11" fill="#f7f3ea" stroke="#d8cfc0" />
      <circle cx="180" cy="320" r="10" fill="#f7f3ea" stroke="#3f7f86" />
      <circle cx="520" cy="330" r="9" fill="#f7f3ea" stroke="#d8cfc0" opacity="0.55" />
      <circle cx="340" cy="220" r="4" fill="#e39b45" />
      <text x="332" y="258" fill="#6d675f" fontSize="12" fontFamily="Georgia, serif">
        you
      </text>
      <text x="96" y="196" fill="#9a9389" fontSize="11">
        a promise
      </text>
      <text x="568" y="176" fill="#9a9389" fontSize="11">
        a plan
      </text>
      <text x="148" y="352" fill="#6d675f" fontSize="11">
        yourself
      </text>
      <text x="486" y="358" fill="#c9c0b1" fontSize="11">
        let go
      </text>
    </svg>
  );
}
