'use client';

import { motion } from 'framer-motion';

type FloatingDotProps = {
  color: string;
  size?: number;
  className?: string;
  duration?: number;
};

export default function FloatingDot({
  color,
  size = 10,
  className = '',
  duration = 3.5,
}: FloatingDotProps) {
  return (
    <motion.span
      className={`absolute rounded-full ${className}`}
      style={{ width: size, height: size, backgroundColor: color }}
      animate={{ y: [0, -10, 0] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden="true"
    />
  );
}
