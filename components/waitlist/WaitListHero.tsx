'use client';

import { SubmitEvent, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { FaCheck, FaSpinner } from 'react-icons/fa';
import Image from 'next/image';
import WavyLine from '../home/WavyLine';
import FloatingDot from '../home/FloatingDot';

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function WaitlistHero() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(
          data.message ?? 'Something went wrong. Please try again.',
        );
        setStatus('error');
        return;
      }

      setStatus('success');
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  return (
    <section className="relative overflow-hidden bg-[#0a0a0a] pt-10 pb-20 sm:pb-36 md:pb-44">
      <div
        className="absolute inset-0 bg-[#6B21D4]"
        style={{
          clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
        }}
      >
        <WavyLine
          color="#F2622E"
          className="absolute -left-2.5 top-82.5 hidden sm:block"
          delay={0.3}
        />
        <WavyLine
          color="#F3C23A"
          className="absolute -left-2.5 top-110 hidden sm:block"
          delay={0.5}
        />

 <WavyLine
          color="#2DD9A6"
          className="absolute -left-2.5 top-135 hidden sm:block"
          delay={0.7}
          
        />
        {/* Right side */}
        <WavyLine
          color="#F2622E"
          className="absolute -right-2.5 top-75 hidden sm:block"
          delay={0.3}
          flip
        />
        <WavyLine
          color="#2DD9A6"
          className="absolute -right-2.5 top-102.5 hidden sm:block"
          delay={0.5}
          flip
        />
        <WavyLine
          color="#FBD3E4"
          className="absolute -right-2.5 top-130 hidden sm:block"
          delay={0.7}
          flip
        />
        <FloatingDot
          color="#F3C23A"
          size={10}
          className="left-15 sm:left-40 top-[130px] sm:top-[220px] sm:block"
        />
        <FloatingDot
          color="#2DD9A6"
          size={10}
          className="right-[95px] sm:right-[195px] top-[135px] sm:top-[195px] sm:block"
          duration={4}
        />
        <FloatingDot
          color="#F3C23A"
          size={8}
          className="right-[65px] sm:right-[165px] top-[345px] sm:top-[545px] sm:block"
          duration={3}
        />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 sm:pt-8 text-center">
        <div className=" ">

        <Image
          src="/k-white.png"
          alt="Logo"
          className="mx-auto object-contain justify-self-center pb-8"
          width={170}
          height={50}
        />
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center"
        >
          <motion.span
            variants={item}
            className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs md:text-sm text-white/90"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            Built for African Creators &amp; Professionals
          </motion.span>

          <motion.h1
            variants={item}
            className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl"
          >
            Connect Smarter
            <br />
            Everywhere.
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-7 max-w-xl text-balance text-base text-white/80 sm:text-lg"
          >
            We&apos;re putting the finishing touches on Konneqta. Join the
            waitlist and be first to create your digital identity / business card.
          </motion.p>

          <motion.div variants={item} className="mt-10 w-full max-w-md">
            <AnimatePresence mode="wait">
              {status === 'success' ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="flex flex-col items-center gap-3 rounded-3xl bg-white/10 px-6 py-8"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2DD9A6]">
                    <FaCheck className="h-6 w-6 text-[#0a0a0a]" />
                  </span>
                  <p className="font-display text-lg font-bold text-white">
                    You&apos;re on the list!
                  </p>
                  <p className="text-sm text-white/70">
                    We&apos;ll email you the moment Konneqta opens up.
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-3 rounded-3xl bg-white/10 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="visible-focus w-full rounded-2xl border-none bg-white/95 px-4 py-3 text-sm text-[#0a0a0a] placeholder:text-[#0a0a0a]/40 sm:rounded-full"
                    />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="visible-focus w-full rounded-2xl border-none bg-white/95 px-4 py-3 text-sm text-[#0a0a0a] placeholder:text-[#0a0a0a]/40 sm:rounded-full"
                    />
                  </div>

                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number (optional)"
                    className="visible-focus w-full rounded-2xl border-none bg-white/95 px-4 py-3 text-sm text-[#0a0a0a] placeholder:text-[#0a0a0a]/40 sm:rounded-full"
                  />

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="visible-focus flex items-center justify-center gap-2 rounded-full bg-[#F3EFE4] hover:bg-(--main-orange) hover:text-white cursor-pointer px-6 py-3 text-sm font-semibold text-[#0a0a0a] shadow-lg shadow-black/20 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {status === 'loading' ? (
                      <FaSpinner className="h-4 w-4 animate-spin" />
                    ) : (
                      'Join Waitlist'
                    )}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {status === 'error' && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 text-sm text-[#F2622E]"
              >
                {errorMessage}
              </motion.p>
            )}

            <p className="mt-4 text-xs text-white/50">
              No spam. We&apos;ll only email you when it&apos;s ready.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
