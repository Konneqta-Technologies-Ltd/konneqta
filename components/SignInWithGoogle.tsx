'use client';

import { createClient } from '@/lib/supabase/client';
import { GoogleIcon } from './GoogleIcon';

export default function SignInWithGoogle() {
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
    <button
      className="visible-focus flex items-center gap-3 rounded-full bg-[#F3EFE4] px-5 py-4 font-semibold text-[#0a0a0a] shadow-lg shadow-black/20 transition-shadow hover:shadow-xl cursor-pointer"
      onClick={handleSignIn}
    >
      <GoogleIcon />
      Sign in with Google
    </button>
  );
}
