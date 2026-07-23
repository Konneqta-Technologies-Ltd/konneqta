'use client';

import { useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { FaCheck } from 'react-icons/fa';

type Cycle = 'monthly' | 'yearly';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.1, ease: 'easeOut' },
  }),
};

const freeFeatures = [
  
  'Offline sharing',
  'One card per person',
  '30 shares monthly',
  'QR code sharing',
];

const proFeatures = [
  'Everything in Free',
  'Custom themes & banners',
  'Branded QR code',
  'Unlimited sharing',
  '1–3 cards per person or email',
  'Analytics dashboard',
];

const pricing = {
  monthly: { usd: '2.35', ngn: '2,850', suffix: '/ month' },
  yearly: { usd: '23.50', ngn: '28,500', suffix: '/ year' },
};

export default function Pricing() {
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const price = pricing[cycle];

  return (
    <section className="relative bg-[#0a0a0a] px-6 py-16 sm:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <motion.p
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50"
        >
          Pricing
        </motion.p>

        <motion.h2
          variants={fadeUp}
          custom={1}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mt-6 font-display text-2xl font-bold leading-tight text-white sm:text-4xl md:text-5xl"
        >
          Simple pricing, <span className="text-[#FF6B2C]">no surprises.</span>
        </motion.h2>

        {/* Monthly / Yearly toggle */}
        <motion.div
          variants={fadeUp}
          custom={2}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mt-10 inline-flex items-center rounded-full border border-white/15 bg-white/5 p-1"
        >
          {(['monthly', 'yearly'] as Cycle[]).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className="visible-focus relative rounded-full px-5 py-2.5 text-sm font-semibold capitalize text-white"
            >
              {cycle === c && (
                <motion.span
                  layoutId="pricing-toggle-pill"
                  className="absolute inset-0 rounded-full bg-[#6B21D4]"
                  transition={{ type: 'spring', duration: 0.5 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {c}
                {c === 'yearly' && (
                  <span className="rounded-full bg-[#FF6B2C] px-2 py-0.5 text-[10px] font-bold text-white">
                    2 months free
                  </span>
                )}
              </span>
            </button>
          ))}
        </motion.div>
      </div>

      <div className="mx-auto mt-10 sm:mt-16 grid max-w-5xl gap-6 sm:grid-cols-3">
        {/* Free */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          whileHover={{ y: -6 }}
          className="flex flex-col rounded-3xl bg-[#F3EFE4] p-6 text-[#0a0a0a] shadow-xl shadow-black/30"
        >
          <span className="mb-6 inline-flex w-fit rounded-full bg-[#0a0a0a]/10 px-3 py-1 text-xs font-semibold">
            Free forever
          </span>
          <h3 className="font-display text-xl font-bold">Starter</h3>
          <p className="mt-2 text-sm text-[#0a0a0a]/70">
            Everything you need to share who you are.
          </p>

          <p className="mt-6 font-display text-4xl font-bold">₦0</p>

          <ul className="mt-6 flex-1 space-y-3 text-sm">
            {freeFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <FaCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#6B21D4]" />
                <span className="text-[#0a0a0a]/80">{f}</span>
              </li>
            ))}
          </ul>

  
        </motion.div>

        {/* Pro */}
        <motion.div
          variants={fadeUp}
          custom={1}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          whileHover={{ y: -6 }}
          className="relative flex flex-col rounded-3xl bg-[#6B21D4] p-6 text-white shadow-xl shadow-black/40"
        >
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#FF6B2C] px-3 py-1 text-xs font-bold">
            Most popular
          </span>

          <span className="mb-6 inline-flex w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
            Pro
          </span>
          <h3 className="font-display text-xl font-bold">Stand out</h3>
          <p className="mt-2 text-sm text-white/70">
            For creators & professionals who want more.
          </p>

          <div className="mt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={cycle}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <p className="font-display text-4xl font-bold">
                  ₦{price.ngn}
                  <span className="ml-2 text-base font-medium text-white/60">
                    {price.suffix}
                  </span>
                </p>
                <p className="mt-1 text-sm text-white/60">
                  ${price.usd} {price.suffix}
                </p>
                {cycle === 'yearly' && (
                  <p className="mt-1 text-xs text-[#2DD9A6]">
                    Just ₦2333/mo billed annually
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <ul className="mt-6 flex-1 space-y-3 text-sm">
            {proFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <FaCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2DD9A6]" />
                <span className="text-white/85">{f}</span>
              </li>
            ))}
          </ul>

         
        </motion.div>

        {/* Team / Business */}
        <motion.div
          variants={fadeUp}
          custom={2}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          whileHover={{ y: -6 }}
          className="flex flex-col rounded-3xl border border-white/10 bg-white/5 p-7 text-white shadow-xl shadow-black/30"
        >
          <span className="mb-6 inline-flex w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
            Team &amp; Business
          </span>
          <h3 className="font-display text-xl font-bold">Konneqta for teams</h3>
          <p className="mt-2 text-sm text-white/60">
            Shared branding, admin controls, and bulk cards for your whole team.
          </p>

          <p className="mt-6 font-display text-2xl font-bold text-white/50">
            Coming soon
          </p>

          <ul className="mt-6 flex-1 space-y-3 text-sm text-white/40">
            <li className="flex items-start gap-2">
              <FaCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Centralized team branding</span>
            </li>
            <li className="flex items-start gap-2">
              <FaCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Bulk card management</span>
            </li>
          </ul>

          <button
            disabled
            className="mt-8 cursor-not-allowed rounded-full border border-white/15 px-5 py-3 font-semibold text-white/40"
          >
            Notify me
          </button>
        </motion.div>
      </div>
    </section>
  );
}
