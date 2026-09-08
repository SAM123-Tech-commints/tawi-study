/** Inline SVG owl icon for the brand logo. Matches public/favicon.svg. */
export function OwlLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
    >
      <rect width="512" height="512" rx="128" fill="#b7e938" />
      <g transform="translate(80, 40)">
        <path
          d="M170 280Q140 220 120 180Q130 160 160 170Q145 130 130 100Q150 110 170 140Q180 100 195 80Q200 105 200 130Q215 90 230 70Q230 100 225 130Q245 110 265 100Q255 130 240 150Q265 130 285 125Q270 160 250 175Q275 165 295 160Q280 190 260 200Q270 200 280 205Q260 230 240 245Q250 265 250 290Q230 320 210 340Q195 360 180 370Q175 360 170 345Q155 360 145 370Q140 360 135 345Q115 325 100 300Q90 275 95 250Q85 230 95 210Q80 200 90 190Q85 170 100 160Q100 145 115 140Q110 120 130 100"
          fill="white"
        />
        <circle cx="170" cy="240" r="58" fill="#b7e938" />
        <circle cx="280" cy="235" r="55" fill="#b7e938" />
        <circle cx="170" cy="240" r="48" fill="white" />
        <circle cx="280" cy="235" r="45" fill="white" />
        <circle cx="180" cy="240" r="30" fill="#b7e938" />
        <circle cx="288" cy="235" r="28" fill="#b7e938" />
        <circle cx="190" cy="230" r="10" fill="white" />
        <circle cx="298" cy="225" r="9" fill="white" />
        <path
          d="M230 275Q255 265 290 280Q300 290 295 300Q280 325 255 340Q240 348 230 345Q215 335 220 310Q225 295 230 275Z"
          fill="#b7e938"
          stroke="white"
          strokeWidth="6"
        />
      </g>
    </svg>
  );
}
