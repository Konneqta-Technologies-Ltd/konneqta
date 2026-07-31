'use client';

import { useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { FaPlus } from 'react-icons/fa';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.1, ease: 'easeOut' },
  }),
};

const faqs = [
  {
    q: 'What makes Konneqta different ?',
    a: 'Other tools just organize links. Konneqta helps you present your professional identity. It brings together your contact details, social profiles, portfolio, business information, and more into one trusted digital identity card that you can share anywhere. The app works offline',
  },
  {
    q: "Do I need an app to view someone's Konneqta card?",
    a: "No. Anyone can open a Konneqta card directly in their browser. There's nothing to install and no account is required to view a shared profile.",
  },
  {
    q: 'Who is Konneqta for?',
    a: 'Konneqta is built for professionals, freelancers, business owners, creators, job seekers, students, and organizations that want to present a trusted digital identity and make it easier for people to connect with them.',
  },
  {
    q: "What's the difference between the Free and Professional plans?",
    a: 'The Free plan gives you everything you need to create and share your digital identity card. Professional unlocks advanced customization, analytics, multiple identity cards, premium themes,  and additional tools designed to help you stand out.',
  },
  {
    q: 'Can I have more than one digital identity card?',
    a: 'Yes. Professional users can create multiple cards for different situations—for example, a work profile, a personal brand, or a business profile—while managing everything from one Konneqta account.',
  },
  {
    q: 'Can I choose what information people see?',
    a: 'Absolutely. You control what appears on your profile. You can update your details anytime and choose which information you want visible, helping you share confidently while protecting your privacy.',
  },
  {
    q: 'Why is QR code sharing important?',
    a: 'Instead of exchanging multiple usernames or contact details, one QR code instantly opens your complete professional profile. It makes networking faster, more memorable, and easier both online and in person.',
  },
  {
    q: 'Does Konneqta support businesses and teams?',
    a: "Yes. Businesses can create and manage digital identity cards for their employees from one dashboard. Teams can maintain consistent branding, verify staff, update employee information, and deactivate cards whenever someone leaves the organization. Though it's yet to be released",
  },
  {
    q: 'How do business accounts work?',
    a: 'Organizations subscribe based on the number of employees they manage. Each employee receives a branded Konneqta identity card, while administrators have access to centralized management, analytics, and company-wide controls.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. Your information belongs to you. You remain in control of your profile and can edit, update, or delete your information at any time. We also give you control over what information is shared with others.',
  },
  {
    q: 'Can I upgrade, downgrade, or cancel my plan?',
    a: 'Yes. You can change your subscription whenever you like. If you cancel a paid plan, your account simply returns to the Free plan at the end of your billing period.',
  },
  {
    q: 'Why should I have a Konneqta card?',
    a: 'Every day you share your phone number, LinkedIn, WhatsApp, portfolio, or website separately. Konneqta brings everything together into one trusted profile, making it easier for clients, employers, colleagues, and new connections to know who you are and how to reach you.',
  },
];

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
        {faqs.map((faq, i) => {
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
