'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { FaFacebook } from 'react-icons/fa';
import { FaInstagram, FaXTwitter, FaLinkedin } from 'react-icons/fa6';

const links = [
  { name: 'Privacy', url: '/privacy' },
  { name: 'Terms', url: '/terms' },
  { name: 'Contact', url: '/contact' },
];

const socialLinks = [
  { name: 'X', url: 'https://x.com/Konneqta', icon: <FaXTwitter /> },
  {
    name: 'Facebook',
    url: 'https://www.facebook.com/konneqta/',
    icon: <FaFacebook />,
  },
  {
    name: 'Instagram',
    url: 'https://instagram.com/konneqta',
    icon: <FaInstagram />,
  },
  {
    name: 'LinkedIn',
    url: 'https://linkedin.com/company/konneqta',
    icon: <FaLinkedin />,
  },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#0a0a0a] pt-8 sm:pt-16">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <Image
          src="/k-white.png"
          alt="Logo"
          className="object-contain w-[150px]"
          width={150}
          height={40}
        />
        <p className="text-sm text-white/50">
          Made for African digital culture.
        </p>
      </div>

      <div className="mx-auto mt-6 flex max-w-5xl flex-col items-center gap-4 px-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex justify-center gap-6 text-sm text-white/60 sm:justify-start">
          {links.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target={link.name == 'Contact' ? '_self' : '_blank'}
              className="visible-focus transition-colors hover:text-white"
            >
              {link.name}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-white/50">Follow us</span>
          <div className="flex items-center gap-3">
            {socialLinks.map((socialLink) => (
              <a
                key={socialLink.name}
                href={socialLink.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Konneqta on ${socialLink.name}`}
                className="visible-focus text-white/60 transition-colors hover:text-white"
              >
                {socialLink.icon}
              </a>
            ))}
          </div>
        </div>
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
