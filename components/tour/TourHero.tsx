'use client';

import { motion, type Variants } from 'framer-motion';

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

export default function TourHero() {
  return (
    <section className="relative overflow-hidden bg-[#0a0a0a] px-6 pb-16 pt-16 text-center">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-2xl"
      >
        <motion.span
          variants={item}
          className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-konneqta-orange" />
          From sign-up to shareable, in minutes
        </motion.span>

        <motion.h1
          variants={item}
          className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl"
        >
          How Konneqta works
        </motion.h1>

        <motion.p variants={item} className="mt-5 text-white/80 sm:text-lg">
          Four steps between you and a digital identity card you can share
          anywhere — by link, by QR, or in person.
        </motion.p>
      </motion.div>
    </section>
  );
}
