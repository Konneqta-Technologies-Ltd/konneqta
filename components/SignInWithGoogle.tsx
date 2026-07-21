'use client';

import { GoogleIcon } from './GoogleIcon';
import Spinner from './ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

export default function SignInWithGoogle() {
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
      className="visible-focus flex items-center gap-3 text-sm sm:text-lg rounded-full bg-[#F3EFE4] px-4 py-3 sm:px-5 sm:py-4 font-semibold text-[#0a0a0a] shadow-lg shadow-black/20 transition-shadow hover:shadow-xl cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
      onClick={handleSignIn}
      disabled={loading}
    >
      {loading ? <Spinner size="sm" className="text-[#0a0a0a]" /> : <GoogleIcon />}
      {loading ? 'Redirecting…' : 'Sign in with Google'}
    </button>
  );
}