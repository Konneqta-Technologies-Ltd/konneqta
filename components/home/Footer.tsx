'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

const links = ['Privacy', 'Terms', 'Contact'];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#0a0a0a] pt-16">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <Image
          src="/k-white.png"
          alt="Logo"
          className="object-contain w-[150px]"
        />
        <p className="text-sm text-white/50">
          Made for African digital culture.
        </p>
      </div>

      <div className="mx-auto mt-6 flex max-w-5xl justify-center gap-6 px-6 text-sm text-white/60 sm:justify-start">
        {links.map((link) => (
          <a
            key={link}
            href="#"
            className="visible-focus transition-colors hover:text-white"
          >
            {link}
          </a>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        aria-hidden="true"
        className="pointer-events-none mt-10 select-none overflow-hidden"
      >
        <p className="font-display -mb-[0.08em] whitespace-nowrap text-center text-[22vw] font-bold leading-none text-white/5">
          konneq<span className="text-[#6B21D4]">ta</span>
        </p>
      </motion.div>
    </footer>
  );
}
