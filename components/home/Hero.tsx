'use client';

import { motion, type Variants } from 'framer-motion';
import Logo from '../../public/k-white.png';
import WavyLine from './WavyLine';
import FloatingDot from './FloatingDot';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { GoogleIcon } from '../GoogleIcon';

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
export default function Hero() {
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
    <section className="relative overflow-hidden bg-[#0a0a0a] pt-10 pb-36 md:pb-44">
      {/* ambient decoration layer */}
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
          className="left-[160px] top-[220px] hidden sm:block"
        />
        <FloatingDot
          color="#2DD9A6"
          size={10}
          className="right-[195px] top-[195px] hidden sm:block"
          duration={4}
        />
        <FloatingDot
          color="#F3C23A"
          size={8}
          className="right-[165px] top-[545px] hidden sm:block"
          duration={3}
        />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <Image
          src={Logo}
          alt="Logo"
          className="w-[100px] object-contain justify-self-center pb-8"
        />

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center"
        >
          <motion.span
            variants={item}
            className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90"
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
            One elegant profile for your bio, links and contact made to share by
            QR and WhatsApp, wherever you go.
          </motion.p>

          <motion.div variants={item} className="mt-10">
            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="visible-focus flex items-center gap-3 rounded-full bg-[#F3EFE4] px-7 py-4 font-semibold text-[#0a0a0a] shadow-lg shadow-black/20 transition-shadow hover:shadow-xl cursor-pointer"
              onClick={handleSignIn}
            >
              <GoogleIcon />
              Continue with Google
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
