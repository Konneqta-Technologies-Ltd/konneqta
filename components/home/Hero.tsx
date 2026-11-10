'use client';

import { useEffect, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import WavyLine from './WavyLine';
import FloatingDot from './FloatingDot';
import Image from 'next/image';
import Link from 'next/link';

import SignInWithGoogle from '@/components/SignInWithGoogle';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa6';
import { getTeamsSignupUrl } from '@/lib/teams-url';

const heroSlides = [
  {
    headingLines: ['Introduce Your Business in', 'One Tap'],
    description:
      'Konneqta is a digital business card platform that lets creators, business owners and professionals build a shareable digital business profile using QR code and links — all in one place',
  },
  {
    headingLines: ["Manage your team's", 'Konneqta presence.'],
    description:
      "One workspace to bring everyone's identity together: consistent, branded and ready to share.",
  },
];

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

export default function Hero({
  cardPath,
  firstName,
}: {
  cardPath: string | null;
  firstName: string | null;
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const automaticRotationEnabled = shouldReduceMotion === false;

  useEffect(() => {
    if (!automaticRotationEnabled) return;

    const timeoutId = window.setTimeout(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 6500);

    return () => window.clearTimeout(timeoutId);
  }, [activeSlide, automaticRotationEnabled]);

  const changeSlide = (direction: -1 | 1) => {
    setActiveSlide(
      (current) =>
        (current + direction + heroSlides.length) % heroSlides.length,
    );
  };

  const slide = heroSlides[activeSlide];

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
          className="absolute -right-2.5 top-102 hidden sm:block"
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
          className="right-8.75 sm:right-41.25 top-86.25 sm:block"
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
          <Link
            href={getTeamsSignupUrl()}
            className="visible-focus text-sm font-semibold text-white/80 transition-colors hover:text-white"
          >
            For teams
          </Link>
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
        <div className="flex flex-col items-center">
          <span className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs md:text-sm text-white/90">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            Built for Creators, Entrepreneurs &amp; Professionals
          </span>

          <motion.div variants={item} className="w-full">
            <div
              role="region"
              aria-roledescription="carousel"
              aria-label="Konneqta for individuals and teams"
              className="w-full"
            >
              <div aria-live={automaticRotationEnabled ? 'off' : 'polite'}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeSlide}
                    initial={{
                      opacity: 0,
                      y: shouldReduceMotion ? 0 : 8,
                    }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      y: shouldReduceMotion ? 0 : -8,
                    }}
                    transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${activeSlide + 1} of ${heroSlides.length}`}
                  >
                    <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-7xl">
                      {slide.headingLines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </h1>

                    <p className="mx-auto mt-7 max-w-xl text-balance text-base text-white/80 sm:text-lg">
                      {slide.description}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div
                role="group"
                aria-label="Hero message controls"
                className="mt-6 flex items-center justify-center gap-3 text-xs font-semibold text-white/80"
              >
                <button
                  type="button"
                  onClick={() => changeSlide(-1)}
                  aria-label="Previous hero message"
                  className="visible-focus rounded-full bg-white/10 px-4 py-2 transition-colors hover:bg-white/20"
                >
                  <FaArrowLeft className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => changeSlide(1)}
                  aria-label="Next hero message"
                  className="visible-focus rounded-full bg-white/10 px-4 py-2 transition-colors hover:bg-white/20"
                >
                  <FaArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </motion.div>

          <div className="mt-10">
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
          </div>
        </div>
      </div>
    </section>
  );
}
