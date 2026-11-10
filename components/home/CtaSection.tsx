import CtaSignIn from './CtaSignIn';
import FloatingDot from './FloatingDot';
import WavyLine from './WavyLine';

/**
 * Bottom call-to-action section — a SERVER component (was a framer-motion
 * client component). The only interactive element is the sign-in button,
 * which is a tiny client island (CtaSignIn). Decorations are the shared
 * CSS-animated WavyLine/FloatingDot server components. Zero animation JS.
 */
export default function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-[#0a0a0a] px-6 pb-16 sm:pb-28 pt-20 sm:pt-40 md:pt-28">
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
          className="absolute sm:right-[-10px] bottom-[10px] hidden sm:block"
          delay={0.3}
          flip
        />
        <FloatingDot
          color="#F3C23A"
          size={10}
          className="left-[60px] sm:left-[190px] top-[60px] sm:block"
        />
        <FloatingDot
          color="#2DD9A6"
          size={10}
          className="right-[60px] sm:right-[220px] top-[60px] sm:block"
          duration={4}
        />
      </div>

      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <h2 className="font-display text-3xl font-bold text-white sm:text-4xl md:text-5xl">
          Share who you are.
        </h2>

        <CtaSignIn />

        <p className="mt-4 text-sm text-white/70">
          Free to start · No credit card
        </p>
      </div>
    </section>
  );
}
