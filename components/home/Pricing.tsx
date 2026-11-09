'use client';

import { useState } from 'react';
import { FaCheck } from 'react-icons/fa';
import Link from 'next/link';

type Cycle = 'monthly' | 'yearly';

const freeFeatures = [
  'Offline sharing',
  'One card per person',
  '25 free shares monthly',
  'QR code sharing',
  '3 free links per card',
  '2 showcase items',
];

const proFeatures = [
  'Everything in Free',
  'Customizable Cards',
  'Branded QR code',
  'Unlimited sharing',
  '1–3 cards per person or email',
  'Analytics dashboard',
  '7 links per card',
  '10 showcase items',
];

const pricing = {
  monthly: { usd: '0.95', ngn: '950', suffix: '/ month' },
  yearly: { usd: '9.50', ngn: '9,500', suffix: '/ year' },
};

/**
 * Pricing section — client island for the billing-cycle toggle only. The
 * framer-motion entrance fades, layout-animated toggle pill and
 * AnimatePresence price swap are replaced with plain conditional classes +
 * CSS (kq-fade-in, hover lifts). All content is still server-prerendered.
 */
export default function Pricing() {
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const price = pricing[cycle];

  return (
    <section className="relative bg-[#0a0a0a] px-6 py-16 sm:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
          Pricing
        </p>

        <h2 className="mt-6 font-display text-2xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
          Simple pricing, <span className="text-[#FF6B2C]">no surprises.</span>
        </h2>

        {/* Monthly / Yearly toggle */}
        <div className="mt-10 inline-flex items-center rounded-full border border-white/15 bg-white/5 p-1">
          {(['monthly', 'yearly'] as Cycle[]).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              aria-pressed={cycle === c}
              className={`visible-focus rounded-full px-5 py-2.5 text-sm font-semibold capitalize text-white transition-colors duration-300 ${cycle === c ? 'bg-[#6B21D4]' : 'hover:bg-white/10'}`}
            >
              <span className="flex items-center gap-2">
                {c}
                {c === 'yearly' && (
                  <span className="rounded-full bg-[#FF6B2C] px-2 py-0.5 text-[10px] font-bold text-white">
                    2 months free
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 sm:mt-16 grid max-w-5xl gap-6 sm:grid-cols-3">
        {/* Free */}
        <div className="flex flex-col rounded-3xl bg-[#F3EFE4] p-6 text-[#0a0a0a] shadow-xl shadow-black/30 transition-transform duration-300 hover:-translate-y-1.5">
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
        </div>

        {/* Pro */}
        <div className="relative flex flex-col rounded-3xl bg-[#6B21D4] p-6 text-white shadow-xl shadow-black/40 transition-transform duration-300 hover:-translate-y-1.5">
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
            <div key={cycle} className="kq-fade-in">
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
                  Just ₦791.6/mo billed annually
                </p>
              )}
            </div>
          </div>

          <ul className="mt-6 flex-1 space-y-3 text-sm">
            {proFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <FaCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2DD9A6]" />
                <span className="text-white/85">{f}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/refund"
            className="mt-4 inline-block text-xs text-white/60 underline-offset-2 hover:text-white hover:underline"
          >
            See Refund Policy
          </Link>
        </div>

        {/* Team / Business */}
        <div className="flex flex-col rounded-3xl border border-white/10 bg-white/5 p-7 text-white shadow-xl shadow-black/30 transition-transform duration-300 hover:-translate-y-1.5">
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
        </div>
      </div>
    </section>
  );
}
