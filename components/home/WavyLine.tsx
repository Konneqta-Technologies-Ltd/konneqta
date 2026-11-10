import type { CSSProperties } from 'react';

type WavyLineProps = {
  color: string;
  width?: number;
  className?: string;
  delay?: number;
  flip?: boolean;
};

/**
 * Decorative squiggle — pure CSS draw-on animation (was framer-motion
 * pathLength/whileInView). Server-rendered: zero JS. `pathLength={1}`
 * normalizes the path so a single dasharray value sweeps the whole line
 * (see the kq-wavy-draw keyframes in app/globals.css).
 */
export default function WavyLine({
  color,
  width = 220,
  className = '',
  delay = 0,
  flip = false,
}: WavyLineProps) {
  const style: CSSProperties = {
    transform: flip ? 'scaleX(-1)' : undefined,
  };

  return (
    <svg
      width={width}
      height={width * 0.25}
      viewBox="0 0 220 55"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        className="kq-wavy-draw"
        style={{ animationDelay: `${delay}s` }}
        pathLength={1}
        d="M2 40C24 10 46 10 68 30C90 50 112 50 134 25C156 0 178 5 218 28"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
