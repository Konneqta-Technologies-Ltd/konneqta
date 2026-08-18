'use client';

import { GoogleIcon } from './GoogleIcon';
import Spinner from './ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

type Variant = 'hero' | 'auth';

/** Homepage Hero CTA — cream pill on the dark purple hero. */
const HERO_CLASSES =
  'visible-focus flex items-center justify-center gap-3 text-sm sm:text-lg rounded-full bg-[#F3EFE4] px-4 py-3 sm:px-5 sm:py-4 font-semibold text-[#0a0a0a] shadow-lg shadow-black/20 transition-shadow hover:shadow-xl cursor-pointer disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Auth forms (login/signup) — full-width bordered button that mirrors the
 * form inputs (border-zinc-700 dark:border-white/50, rounded-xl) and is
 * dark-mode aware.
 */
const AUTH_CLASSES =
  'flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/50 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800';

export default function SignInWithGoogle({
  label = 'Sign in with Google',
  variant = 'hero',
}: {
  label?: string;
  variant?: Variant;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } catch {
      // If the OAuth redirect fails (rare), reset so the user can retry.
      setLoading(false);
    }
    // Note: on success the browser navigates away, so we intentionally
    // do NOT setLoading(false) in a finally block — that would flicker
    // the button back to idle right before the redirect fires.
  }

  return (
    <button
      className={variant === 'hero' ? HERO_CLASSES : AUTH_CLASSES}
      onClick={handleSignIn}
      disabled={loading}
    >
      {loading ? (
        <Spinner size="sm" className={variant === 'hero' ? 'text-[#0a0a0a]' : ''} />
      ) : (
        <GoogleIcon />
      )}
      {loading ? 'Redirecting…' : label}
    </button>
  );
}