'use client';

import { useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { FaPlus } from 'react-icons/fa';
import { FAQS } from './faq-data';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.1, ease: 'easeOut' },
  }),
};

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="relative bg-[#0a0a0a] px-6 pb-16">
      <div className="mx-auto max-w-3xl text-center">
        <motion.p
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50"
        >
          FAQ
        </motion.p>

        <motion.h2
          variants={fadeUp}
          custom={1}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mt-6 font-display text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl"
        >
          Questions, <span className="text-[#FF6B2C]">answered.</span>
        </motion.h2>

        <motion.p
          variants={fadeUp}
          custom={2}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mt-5 text-white/60"
        >
          Everything you need to know before you make your card.
        </motion.p>
      </div>

      <div className="mx-auto mt-14 max-w-2xl divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/15">
        {FAQS.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <motion.div
              key={faq.q}
              variants={fadeUp}
              custom={i % 6}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="visible-focus flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="font-display font-semibold text-white">
                  {faq.q}
                </span>
                <motion.span
                  animate={{ rotate: isOpen ? 45 : 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6B21D4]"
                >
                  <FaPlus className="h-4 w-4 text-white" />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-sm leading-relaxed text-white/65">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
