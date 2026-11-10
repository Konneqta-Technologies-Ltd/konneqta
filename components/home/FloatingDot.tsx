import type { CSSProperties } from 'react';

type FloatingDotProps = {
  color: string;
  size?: number;
  className?: string;
  duration?: number;
};

/**
 * Ambient floating dot — pure CSS keyframe loop (was framer-motion
 * y:[0,-10,0] repeat). Server-rendered: zero JS.
 */
export default function FloatingDot({
  color,
  size = 10,
  className = '',
  duration = 3.5,
}: FloatingDotProps) {
  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundColor: color,
    animationDuration: `${duration}s`,
  };

  return (
    <span
      className={`kq-float absolute rounded-full ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}
