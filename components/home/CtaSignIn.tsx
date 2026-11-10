'use client';

import { GoogleIcon } from '@/components/GoogleIcon';
import { createClient } from '@/lib/supabase/client';

/**
 * The CTA section's sign-in button — the ONLY interactive island in the
 * (now server-rendered) CTA section. Hover/tap feedback is pure CSS.
 */
export default function CtaSignIn() {
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
      className="visible-focus mt-9 flex items-center gap-3 rounded-full bg-[#F3EFE4] text-sm sm:text-lg px-4 py-2 sm:px-7 sm:py-4 font-semibold text-[#0a0a0a] shadow-lg shadow-black/20 cursor-pointer transition-transform duration-200 hover:scale-[1.03] hover:-translate-y-0.5 active:scale-[0.98]"
      onClick={handleSignIn}
    >
      <GoogleIcon />
      Create my profile — it&apos;s free
    </button>
  );
}
