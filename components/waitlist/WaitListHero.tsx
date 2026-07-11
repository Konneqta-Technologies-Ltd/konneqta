'use client';

import { useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { FaCheck, FaSpinner } from 'react-icons/fa';
import Image from 'next/image';
import WavyLine from '../home/WavyLine';
import FloatingDot from '../home/FloatingDot';
import { createClient } from '@/lib/supabase/client';

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
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const supabase = createClient();

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setStatus('loading');
    setErrorMessage('');

    const { error } = await supabase
      .from('waitlist')
      .insert({ name: name.trim(), email: email.trim().toLowerCase() });

    if (error) {
      if (error.code === '23505') {
        setErrorMessage("You're already on the list — we'll be in touch!");
      } else {
        setErrorMessage('Something went wrong. Please try again.');
      }
      setStatus('error');
      return;
    }
    setStatus('success');
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
          className="absolute left-[-10px] top-[330px] hidden sm:block"
          delay={0.3}
        />
        <WavyLine
          color="#F3C23A"
          className="absolute left-[-10px] top-[440px] hidden sm:block"
          delay={0.5}
        />
        <WavyLine
          color="#F2622E"
          className="absolute right-[-10px] top-[300px] hidden sm:block"
          delay={0.3}
          flip
        />
        <WavyLine
          color="#2DD9A6"
          className="absolute right-[-10px] top-[410px] hidden sm:block"
          delay={0.5}
          flip
        />
        <WavyLine
          color="#FBD3E4"
          className="absolute right-[-10px] top-[520px] hidden sm:block"
          delay={0.7}
          flip
        />
        <FloatingDot
          color="#F3C23A"
          size={10}
          className="left-[60px] sm:left-[160px] top-[130px] sm:top-[220px] sm:block"
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
        <Image
          src="/k-white.png"
          alt="Logo"
          className="w-[100px] object-contain justify-self-center pb-8"
          width={100}
          height={30}
        />

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
            Built for African creators &amp; professionals
          </motion.span>

          <motion.h1
            variants={item}
            className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl"
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
            waitlist and be first to claim your digital identity card.
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
                  className="flex flex-col gap-3 rounded-3xl bg-white/10 p-4 sm:flex-row sm:items-start sm:p-2"
                >
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row">
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
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="visible-focus flex items-center justify-center gap-2 rounded-full bg-[#F3EFE4] px-6 py-3 text-sm font-semibold text-[#0a0a0a] shadow-lg shadow-black/20 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {status === 'loading' ? (
                      <FaSpinner className="h-4 w-4 animate-spin" />
                    ) : (
                      'Join waitlist'
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
              No spam. We&apos;ll only email you when it&apos;s your turn.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
