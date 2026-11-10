'use client';

import { useState } from 'react';
import { FaPlus } from 'react-icons/fa';
import { FAQS } from './faq-data';

/**
 * FAQ section — small client island (accordion state only). The framer-motion
 * entrance fades and AnimatePresence height animation are gone: items are
 * static HTML, open/close + icon rotation are pure CSS transitions.
 */
export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="relative bg-[#0a0a0a] px-6 pb-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
          FAQ
        </p>

        <h2 className="mt-6 font-display text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
          Questions, <span className="text-[#FF6B2C]">answered.</span>
        </h2>

        <p className="mt-5 text-white/60">
          Everything you need to know before you make your card.
        </p>
      </div>

      <div className="mx-auto mt-14 max-w-2xl divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/15">
        {FAQS.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={faq.q}>
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="visible-focus flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="font-display font-semibold text-white">
                  {faq.q}
                </span>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6B21D4] transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}
                >
                  <FaPlus className="h-4 w-4 text-white" />
                </span>
              </button>

              {/* CSS grid-rows collapse — animates height without JS or a
                  layout-measuring animation library. */}
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
              >
                <div className="overflow-hidden">
                  <p className="px-6 pb-5 text-sm leading-relaxed text-white/65">
                    {faq.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
