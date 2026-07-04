'use client';

import { motion } from 'framer-motion';
import WavyLine from './WavyLine';
import FloatingDot from './FloatingDot';
import { createClient } from '@/lib/supabase/client';

export default function CtaSection() {
  const supabase = createClient();

  async function handleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <section className="relative overflow-hidden bg-[#0a0a0a] px-6 pb-28 pt-40 md:pt-28">
      <div
        className="pointer-events-none absolute inset-0 bg-[#6B21D4]"
        style={{
          clipPath: 'polygon(0 12%, 50% 0, 100% 12%, 100% 100%, 0 100%)',
        }}
      >
        <WavyLine
          color="#F2622E"
          className="absolute left-[-10px] bottom-[70px] hidden sm:block"
        />
        <WavyLine
          color="#F3C23A"
          className="absolute left-[-10px] bottom-[10px] hidden sm:block"
          delay={0.2}
        />
        <WavyLine
          color="#FBD3E4"
          className="absolute right-[-10px] bottom-[70px] hidden sm:block"
          delay={0.1}
          flip
        />
        <WavyLine
          color="#2DD9A6"
          className="absolute right-[-10px] bottom-[10px] hidden sm:block"
          delay={0.3}
          flip
        />
        <FloatingDot
          color="#F3C23A"
          size={10}
          className="left-[190px] top-[60px] hidden sm:block"
        />
        <FloatingDot
          color="#2DD9A6"
          size={10}
          className="right-[220px] top-[60px] hidden sm:block"
          duration={4}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative mx-auto flex max-w-2xl flex-col items-center text-center"
      >
        <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">
          Share who you are.
        </h2>

        <motion.button
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="visible-focus mt-9 flex items-center gap-3 rounded-full bg-[#F3EFE4] px-7 py-4 font-semibold text-[#0a0a0a] shadow-lg shadow-black/20 cursor-pointer"
          onClick={handleSignIn}
        >
          <GoogleIcon />
          Create my profile — it&apos;s free
        </motion.button>

        <p className="mt-4 text-sm text-white/70">
          Free to start · No credit card
        </p>
      </motion.div>
    </section>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.36 0-4.36-1.6-5.07-3.74H.9v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.93 10.68A5.4 5.4 0 0 1 3.65 9c0-.58.1-1.15.28-1.68V4.99H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.01l3.03-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.99l3.03 2.33C4.64 5.18 6.64 3.58 9 3.58z"
      />
    </svg>
  );
}
