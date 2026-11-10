/**
 * "What is Konneqta" section — a SERVER component (was a framer-motion
 * client component). All content is static HTML (below the fold, so no
 * entrance animation is needed); the step cards keep their hover lift as a
 * pure-CSS Tailwind transition. Zero JS shipped for this section.
 */

const audiences = [
  'Creators',
  'Freelancers',
  'Entrepreneurs',
  'Students',
  'Modern professionals',
];

const steps = [
  {
    number: 1,
    title: 'Sign up',
    description: 'One tap with Google — no long forms, no onboarding walls.',
    bg: 'bg-[#F6EEE0]',
    badge: 'bg-[#6B21D4] text-white',
    text: 'text-[#0a0a0a]',
    rotation: '-rotate-3',
  },
  {
    number: 2,
    title: 'Build your card',
    description: 'Add your name, role, links, showcase items and pick your look.',
    bg: 'bg-[#34D3A6]',
    badge: 'bg-[#0A2A20] text-[#34D3A6]',
    text: 'text-[#0A2A20]',
    rotation: 'rotate-1 mt-5',
  },
  {
    number: 3,
    title: 'Share everywhere',
    description: 'Send via WhatsApp, show your QR, or drop the link.',
    bg: 'bg-[#F7D6E4]',
    badge: 'bg-[#FF6B2C] text-white',
    text: 'text-[#1C140C]',
    rotation: '-rotate-3',
  },
];

export default function WhatIsSection() {
  return (
    <section className="relative bg-[#0a0a0a] px-6 pb-16 sm:pb-28 sm:pt-24 pt-10">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
          What Konneqta is
        </p>

        <h2 className="mt-6 font-display text-2xl font-bold leading-tight text-white sm:text-3xl md:text-5xl">
          Konneqta isn&apos;t a link-in-bio.
          <br />
          It&apos;s who you are and what you do,
          <span className="text-[#FF6B2C]">made shareable.</span>
        </h2>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          {audiences.map((a) => (
            <span
              key={a}
              className="rounded-full border border-white/15 bg-white/5 px-2 sm:px-4 py-2 text-sm text-white/80"
            >
              {a}
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-16 grid max-w-5xl gap-6 sm:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.number}
            className={`rounded-3xl p-7 ${step.bg} ${step.text} ${step.rotation} shadow-xl shadow-black/30 transition-transform duration-300 hover:-translate-y-1.5`}
          >
            <span
              className={`mb-6 inline-flex h-9 w-9 items-center justify-center rounded-xl font-display font-bold ${step.badge}`}
            >
              {step.number}
            </span>
            <h3 className="font-display text-xl font-bold">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#0a0a0a]/70">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
