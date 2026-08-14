'use client';

import { motion, type Variants } from 'framer-motion';
import Link from 'next/link';
import WavyLine from './WavyLine';
import FloatingDot from './FloatingDot';
import Image from 'next/image';
import SignInWithGoogle from '@/components/SignInWithGoogle';

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

export default function Hero({ cardPath, firstName }: { cardPath: string | null; firstName: string | null }) {
  return (
    <section className="relative overflow-hidden bg-[#0a0a0a] pt-10 pb-20 sm:pb-36 md:pb-44">
      {/* ambient decoration layer */}
      <div
        className="absolute inset-0 bg-[#6B21D4]"
        style={{
          clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
        }}
      >
        <WavyLine
          color="#F2622E"
          className="absolute -left-2.5 top-75   hidden sm:block"
          delay={0.3}
        />
        <WavyLine
          color="#F3C23A"
          className="absolute -left-2.5 top-102 hidden sm:block"
          delay={0.5}
        />

 <WavyLine
          color="#2DD9A6"
          className="absolute -left-2.5 top-130 hidden sm:block"
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
          className="absolute -right-2.5 top-102   hidden sm:block"
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
          className="left-15 sm:left-40 top-55 sm:block"
        />
        <FloatingDot
          color="#2DD9A6"
          size={10}
          className="right-8.75 sm:right-48.75 top-48.75 sm:block"
          duration={4}
        />
        <FloatingDot
          color="#F3C23A"
          size={8}
          className="right-8.75 sm:right-41.25 top-86.25 sm:top-136.25 sm:block"
          duration={3}
        />
      </div>

      {/* header nav */}
      <div className="relative mx-auto flex max-w-5xl items-center justify-between px-6">
        <Image
          src="/k-white.png"
          alt="Logo"
          className="w-25 object-contain"
          width={100}
          height={30}
        />

        <nav className="flex items-center gap-6">
          {cardPath ? (
            <Link
              href={cardPath}
              className="visible-focus rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#6B21D4] transition-colors hover:bg-white/90"
            >
              {firstName ? `Hi, ${firstName}` : 'Go to my card'}
            </Link>
          ) : (
            <>
              <Link
                href="/auth/signup"
                className="visible-focus rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                Sign up
              </Link>

              <Link
                href="/auth/login"
                className="visible-focus text-sm font-semibold text-white/80 transition-colors hover:text-white"
              >
                Login
              </Link>
            </>
          )}
        </nav>
      </div>

      <div className="relative mx-auto max-w-3xl px-6 pt-8 sm:pt-16 text-center">
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
            Built for  Creators &amp; Professionals
          </motion.span>

          <motion.h1
            variants={item}
            className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-7xl"
          >
            Introduce yourself in 
            <br/>
            One Tap          
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-7 max-w-xl text-balance text-base text-white/80 sm:text-lg"
          >
            Konneqta is a digital identity card platform that lets creators and professionals build a shareable digital profile with QR codes and WhatsApp-ready links — all in one place
          </motion.p>

          <motion.div variants={item} className="mt-10">
            {cardPath ? (
              <Link
                href={cardPath}
                className="visible-focus inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-[#6B21D4] transition-colors hover:bg-white/90"
              >
                Go to my card
              </Link>
            ) : (
              <SignInWithGoogle />
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
