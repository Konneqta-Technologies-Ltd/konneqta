import OnboardingForm from '@/components/OnboardingForm';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  // A profile without a primary card is an interrupted setup and must remain
  // repairable through the onboarding form.
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  const { data: primaryCard } = await supabase
    .from('cards')
    .select('slug')
    .eq('owner_id', user.id)
    .eq('is_primary', true)
    .maybeSingle();

  if (profile && primaryCard) {
    redirect(`/${profile.username}`);
  }

  const fullName = user.user_metadata?.full_name ?? '';
  const email = user.email ?? '';

  return <OnboardingForm fullName={fullName} email={email} />;
}
