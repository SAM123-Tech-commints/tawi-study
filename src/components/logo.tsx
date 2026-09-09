"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Brand owl. Uses public/logo.png (transparent white owl, no background) when
 * it loads correctly — save the chat PNG there and it is picked up
 * automatically. Anything else (missing file, wrong name, corrupt bytes)
 * instantly falls back to the matching inline SVG, so a broken-image icon
 * can never stick on screen.
 */
export function OwlLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  const [imgOk, setImgOk] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Catch images that "load" as 0×0 (corrupt/empty file): fall back too.
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth < 2) setImgOk(false);
  });

  if (imgOk) {
    return (
      <img
        ref={imgRef}
        src="/logo.png"
        alt=""
        aria-label="Tawi Study"
        width={size}
        height={size}
        className={`rounded-[28%] object-cover ${className}`}
        style={{ background: "var(--color-brand-500)" }}
        onError={() => setImgOk(false)}
        onLoad={(e) => {
          if ((e.target as HTMLImageElement).naturalWidth < 2) setImgOk(false);
        }}
      />
    );
  }
  return <OwlSvg size={size} className={className} />;
}

function OwlSvg({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Tawi Study"
    >
      <rect width="512" height="512" rx="120" fill="var(--color-brand-500)" />
      {/* Spiky feather head silhouette */}
      <path
        d="M262 78 Q300 78 322 118 Q392 132 428 196 Q462 262 438 332 Q414 402 344 434 Q274 464 204 446 Q134 428 104 360 Q78 296 96 232 Q110 172 168 148 Q158 112 188 108 Q218 102 262 78 Z"
        fill="white"
      />
      {/* Left feather tufts */}
      <path
        d="M168 148 Q120 160 96 200 Q130 196 168 188 Z M132 250 Q96 268 88 306 Q122 296 150 282 Z M150 350 Q124 378 124 410 Q154 396 178 372 Z"
        fill="white"
      />
      {/* Eyes: accent rings, white centers, accent pupils */}
      <circle cx="228" cy="258" r="62" fill="var(--color-brand-500)" />
      <circle cx="352" cy="250" r="54" fill="var(--color-brand-500)" />
      <circle cx="228" cy="258" r="42" fill="white" />
      <circle cx="352" cy="250" r="36" fill="white" />
      <circle cx="240" cy="246" r="17" fill="var(--color-brand-500)" />
      <circle cx="362" cy="238" r="15" fill="var(--color-brand-500)" />
      {/* Beak */}
      <path
        d="M290 300 Q350 288 392 312 Q410 326 402 348 Q392 372 360 372 Q330 372 310 360 Q292 350 290 332 Q288 314 290 300 Z"
        fill="var(--color-brand-500)"
        stroke="white"
        strokeWidth="10"
        strokeLinejoin="round"
      />
    </svg>
  );
}
