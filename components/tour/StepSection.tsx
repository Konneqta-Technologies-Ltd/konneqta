'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { FaCheck } from 'react-icons/fa';

type StepImage = {
  src: string;
  alt: string;
};

type StepSectionProps = {
  index: number;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  images: StepImage[];
};

export default function StepSection({
  index,
  eyebrow,
  title,
  description,
  bullets,
  images,
}: StepSectionProps) {
  const reverse = index % 2 === 1;

  return (
    <div
      className={`mx-auto flex max-w-5xl flex-col items-center gap-12 py-16 sm:py-16 lg:flex-row ${
        reverse ? 'lg:flex-row-reverse' : ''
      }`}
    >
      {/* Text column */}
      <motion.div
        initial={{ opacity: 0, x: reverse ? 30 : -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full px-6 lg:w-1/2 lg:px-0"
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-konneqta-purple text-[11px] font-bold text-white">
            {index + 1}
          </span>
          {eyebrow}
        </span>

        <h2 className="mt-5 font-display text-2xl font-bold leading-tight text-white sm:text-3xl">
          {title}
        </h2>

        <p className="mt-3 text-white/70">{description}</p>

        <ul className="mt-6 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm">
              <FaCheck className="mt-0.5 h-4 w-4 shrink-0 text-konneqta-teal" />
              <span className="text-white/75">{b}</span>
            </li>
          ))}
        </ul>
      </motion.div>

      {/* Image column */}
      <motion.div
        initial={{ opacity: 0, x: reverse ? -30 : 30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
        className="flex w-full justify-center gap-4 px-6 lg:w-1/2 lg:px-0"
      >
        {images.map((img) => (
          <div
            key={img.src}
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl shadow-black/40"
          >
            <Image
              src={img.src}
              alt={img.alt}
              width={340}
              height={480}
              className="h-auto w-full max-w-[220px] object-cover sm:max-w-[260px]"
            />
          </div>
        ))}
      </motion.div>
    </div>
  );
}
