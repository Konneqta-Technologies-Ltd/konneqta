'use client';

import { motion } from 'framer-motion';

type WavyLineProps = {
  color: string;
  width?: number;
  className?: string;
  delay?: number;
  flip?: boolean;
};

/**
 * A single hand-drawn-feeling squiggle used as ambient decoration.
 * Draws itself in on mount using pathLength animation.
 */
export default function WavyLine({
  color,
  width = 220,
  className = '',
  delay = 0,
  flip = false,
}: WavyLineProps) {
  return (
    <svg
      width={width}
      height={width * 0.25}
      viewBox="0 0 220 55"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
      aria-hidden="true"
    >
      <motion.path
        d="M2 40C24 10 46 10 68 30C90 50 112 50 134 25C156 0 178 5 218 28"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, delay, ease: 'easeInOut' }}
      />
    </svg>
  );
}
