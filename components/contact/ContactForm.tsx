'use client';

import { useState, SubmitEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaArrowCircleLeft, FaCheck, FaSpinner } from 'react-icons/fa';
import Link from 'next/link';
import DarkModeToggle from '../DarkModeToggle';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
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
    <section className="relative overflow-hidden bg-white dark:bg-[#0a0a0a] px-6 py-20 sm:py-28">
      <DarkModeToggle />
      <div className="relative mx-auto max-w-xl text-center">
        <Link
          href="/"
          className="text-xs font-medium text-[#6B21D4] dark:text-(--main-orange) transition-colors dark:hover:text-white flex items-center justify-center gap-2"
        >
          <FaArrowCircleLeft /> Back to Konneqta
        </Link>

        <h1 className="font-display mt-6 text-3xl font-bold leading-tight tracking-tight text-[#171616] dark:text-white sm:text-5xl">
          Get in touch
        </h1>
        <p className="mt-4 text-balance text-base text-[#171616]/70 dark:text-white/60 sm:text-lg">
          Questions, feedback, or partnership ideas - we&apos;d love to hear
          from you.
        </p>

        <div className="mt-10">
          <AnimatePresence mode="wait">
            {status === 'success' ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="flex flex-col items-center gap-3 rounded-3xl bg-[#F2622E] dark:bg-[#6B21D4] px-6 py-10"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2DD9A6]">
                  <FaCheck className="h-6 w-6 text-[#0a0a0a]" />
                </span>
                <p className="font-display text-lg font-bold text-white">
                  Message sent!
                </p>
                <p className="text-sm text-white/70">
                  Thanks for reaching out — we&apos;ll get back to you soon.
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
                className="flex flex-col gap-3 rounded-3xl bg-[#6B21D4]/70 dark:bg-white/10 p-4 text-left"
              >
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="visible-focus w-full rounded-2xl border-none bg-white/95 px-4 py-3 text-sm text-[#0a0a0a] placeholder:text-[#0a0a0a]/40"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="visible-focus w-full rounded-2xl border-none bg-white/95 px-4 py-3 text-sm text-[#0a0a0a] placeholder:text-[#0a0a0a]/40"
                />
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help?"
                  className="visible-focus w-full resize-none rounded-2xl border-none bg-white/95 px-4 py-3 text-sm text-[#0a0a0a] placeholder:text-[#0a0a0a]/40"
                />

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="visible-focus flex items-center justify-center gap-2 rounded-full bg-(--main-orange) dark:bg-[#F3EFE4] px-6 py-3 text-sm font-semibold dark:text-[#0a0a0a] text-white shadow-lg shadow-black/20 transition-transform hover:scale-[1.02] dark:hover:bg-(--main-orange) dark:hover:text-white hover:bg-white/80 hover:text-(--main-orange) disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
                >
                  {status === 'loading' ? (
                    <FaSpinner className="h-4 w-4 animate-spin" />
                  ) : (
                    'Send Message'
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
            Prefer email? Reach us directly at{' '}
            <a
              href="mailto:info@konneqta.com"
              className="text-white/70 underline hover:text-white"
            >
              info@konneqta.com
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
