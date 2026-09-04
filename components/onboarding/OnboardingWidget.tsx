'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import {
  hasSeenProductTour,
  markProductTourSeen,
  OPEN_PRODUCT_TOUR_EVENT,
} from '@/lib/onboarding';
import { ONBOARDING_STEPS } from '@/lib/onboardingSteps';
import { usePathname, useRouter } from 'next/navigation';

type Stage = 'hidden' | 'welcome' | 'touring';

const fadeVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2, ease: 'easeIn' } },
};

export default function OnboardingWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [hasCard, setHasCard] = useState<boolean | null>(null);
  const [stage, setStage] = useState<Stage>('hidden');
  const [stepIndex, setStepIndex] = useState(0);

  const isExcludedRoute =
    pathname.startsWith('/auth/') ||
    pathname === '/post-login' ||
    pathname === '/privacy' ||
    pathname === '/terms' ||
    pathname === '/refund' ||
    pathname === '/waitlist' ||
    pathname === '/';
  const isOwnProfileRoute =
    Boolean(username) &&
    (pathname === `/${username}` || pathname.startsWith(`/${username}/`));
  const isAppRoute =
    pathname === '/onboarding' ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/referral');
  const canShowTour =
    Boolean(userId && (username || hasCard === false)) &&
    !isExcludedRoute &&
    (isOwnProfileRoute || isAppRoute);
  const currentStep = ONBOARDING_STEPS[stepIndex];

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user?.id) {
        setUserId(null);
        setUsername(null);
        setHasCard(null);
        return;
      }

      setUserId(user.id);
      const [{ data }, { data: card }] = await Promise.all([
        supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('cards')
          .select('id')
          .eq('owner_id', user.id)
          .eq('is_primary', true)
          .maybeSingle(),
      ]);
      if (active) {
        setUsername(data?.username ?? null);
        setHasCard(Boolean(card));
      }
    };

    void loadUser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadUser();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!canShowTour || !userId) return;
    hasSeenProductTour(userId).then((seen) => {
      if (!seen) setStage('welcome');
    });
  }, [canShowTour, userId]);

  useEffect(() => {
    const openTour = () => {
      setStepIndex(0);
      setStage('touring');
    };
    window.addEventListener(OPEN_PRODUCT_TOUR_EVENT, openTour);
    return () => window.removeEventListener(OPEN_PRODUCT_TOUR_EVENT, openTour);
  }, []);

  useEffect(() => {
    if (stage !== 'touring' || !currentStep.route) return;
    const route =
      currentStep.id === 'identity-card'
        ? hasCard
          ? 'edit'
          : 'onboarding'
        : currentStep.route;
    const destination =
      route === 'onboarding'
        ? '/onboarding'
        : !username
          ? null
          : route === 'profile'
            ? `/${username}`
            : route === 'edit'
              ? `/${username}/edit`
              : `/${username}/${route}`;
    if (destination && pathname !== destination) router.push(destination);
  }, [
    currentStep.id,
    currentStep.route,
    hasCard,
    pathname,
    router,
    stage,
    username,
  ]);

  useEffect(() => {
    if (stage !== 'touring' || !currentStep.target) return;
    const target = document.querySelector<HTMLElement>(
      `[data-tour="${currentStep.target}"]`,
    );
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.dataset.tourActive = 'true';
    target.style.position = 'relative';
    target.style.zIndex = '60';
    target.style.boxShadow = '0 0 0 4px var(--main-orange)';

    return () => {
      delete target.dataset.tourActive;
      target.style.removeProperty('position');
      target.style.removeProperty('z-index');
      target.style.removeProperty('box-shadow');
    };
  }, [currentStep.target, pathname, stage]);

  async function finish() {
    setStage('hidden');
    if (userId) await markProductTourSeen(userId);
  }

  function handleSkip() {
    finish();
  }

  function handleStart() {
    setStepIndex(0);
    setStage('touring');
  }

  function handleNext() {
    if (stepIndex === ONBOARDING_STEPS.length - 1) {
      finish();
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  function handlePrevious() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  if (!canShowTour || stage === 'hidden') return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-100 flex items-start justify-end bg-black/50 px-2 py-2 sm:px-4 sm:py-4"
      role="presentation"
    >
      <AnimatePresence mode="wait">
        {stage === 'welcome' && (
          <motion.div
            key="welcome"
            variants={fadeVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="pointer-events-auto w-full max-w-md rounded-2xl bg-white p-3 shadow-xl sm:p-6 dark:bg-neutral-900"
            role="dialog"
            aria-modal="false"
            aria-labelledby="product-tour-welcome-title"
          >
            <h2
              id="product-tour-welcome-title"
              className="text-sm sm:text-xl font-semibold text-neutral-900 dark:text-white"
            >
              Welcome to Konneqta
            </h2>
            <p className="mt-2 text-[10px] sm:text-sm text-neutral-600 dark:text-neutral-300">
              Want a quick walkthrough on setting up your digital identity card
              and getting the most out of Konneqta? It only takes a minute.
            </p>
            <div className="mt-3 sm:mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleSkip}
                className="rounded-lg px-2 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-sm font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleStart}
                className="rounded-lg px-2 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--main-orange)' }}
              >
                Continue
              </button>
            </div>
          </motion.div>
        )}

        {stage === 'touring' && (
          <motion.div
            key={`step-${stepIndex}`}
            variants={fadeVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="pointer-events-auto w-full max-w-md rounded-2xl bg-white p-3 shadow-xl sm:p-6 dark:bg-neutral-900"
            role="dialog"
            aria-modal="false"
            aria-labelledby="product-tour-step-title"
          >
            <h2
              id="product-tour-step-title"
              className="text-sm sm:text-xl font-semibold text-neutral-900 dark:text-white"
            >
              {currentStep.title}
            </h2>
            <p className="mt-2 text-[10px] sm:text-sm text-neutral-600 dark:text-neutral-300">
              {currentStep.description}
            </p>

            <div className="mt-4 flex justify-center gap-1.5">
              {ONBOARDING_STEPS.map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      i === stepIndex ? 'var(--main-orange)' : '#d4d4d4',
                  }}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={handleSkip}
                className="text-sm px-2 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-sm font-medium text-neutral-500 hover:underline"
              >
                Skip
              </button>
              <div className="flex gap-2">
                {stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePrevious}
                    className="rounded-lg border px-2 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-sm font-medium text-neutral-700 dark:text-neutral-200"
                  >
                    Previous
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-lg px-2 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-sm font-medium text-white"
                  style={{ backgroundColor: 'var(--main-orange)' }}
                >
                  {stepIndex === ONBOARDING_STEPS.length - 1
                    ? 'Finish'
                    : 'Next'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
