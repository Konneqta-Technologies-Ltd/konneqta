'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import {
  hasSeenProductTour,
  markProductTourSeen,
  hasSeenVisitorTour,
  markVisitorTourSeen,
  OPEN_PRODUCT_TOUR_EVENT,
  OPEN_VISITOR_TOUR_EVENT,
  requestCardFlip,
} from '@/lib/onboarding';
import {
  ONBOARDING_STEPS,
  type OnboardingStep,
  type TourRoute,
} from '@/lib/onboardingSteps';
import {
  VISITOR_TOUR_STEPS,
  type VisitorTourStep,
} from '@/lib/visitorTourSteps';
import { useDriverTour, waitForElement } from '@/hooks/useDriverTour';
import { useTrack } from '@/lib/use-track';
import { isPro } from '@/lib/entitlements';
import { usePathname, useRouter } from 'next/navigation';
// Global driver.js base styles — everything Konneqta-specific is restyled in
// app/globals.css (`.konneqta-tour-*`).
import 'driver.js/dist/driver.css';

type Stage = 'hidden' | 'welcome' | 'visitor-welcome' | 'touring';
type TourKind = 'owner' | 'visitor';
type TourTrigger = 'auto' | 'sidenav' | 'help-button';

const fadeVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2, ease: 'easeIn' } },
};

/** Top-level path segments that are NOT a public card page. Used to decide
 *  where the visitor tour may auto-show / render its welcome card. */
const NON_PROFILE_SEGMENTS = new Set([
  'settings',
  'referral',
  'tour',
  'contact',
  'privacy',
  'terms',
  'refund',
  'waitlist',
  'onboarding',
  'post-login',
  'auth',
  'api',
  '_next',
  'icons',
  'manifest.webmanifest',
  'sw.js',
  'robots.txt',
  'sitemap.xml',
  'favicon.ico',
]);

/** True only for `/{username}` (single segment, non-reserved). */
function isPublicCardRoute(pathname: string): boolean {
  const match = /^\/([^/]+)$/.exec(pathname);
  if (!match) return false;
  return !NON_PROFILE_SEGMENTS.has(match[1]);
}

export default function OnboardingWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const track = useTrack();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [hasCard, setHasCard] = useState<boolean | null>(null);
  const [isProUser, setIsProUser] = useState<boolean | null>(null);
  /** False until the first auth check completes — distinguishes "still
   *  loading" from "signed out" for the visitor auto-show. */
  const [authResolved, setAuthResolved] = useState(false);
  const [stage, setStage] = useState<Stage>('hidden');
  const [kind, setKind] = useState<TourKind | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  /** Visitor steps are filtered at tour start (showcase presence is a DOM
   *  fact the widget can't know until the card page has rendered). */
  const [visitorSteps, setVisitorSteps] =
    useState<VisitorTourStep[]>(VISITOR_TOUR_STEPS);

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

  /** Owner steps for THIS user (Pro users skip the upsell step). */
  const ownerSteps = useMemo(
    () =>
      ONBOARDING_STEPS.filter((s) => !(s.onlyWhenNotPro && isProUser === true)),
    [isProUser],
  );
  // ── Auth + profile loading ─────────────────────────────────────────────
  // Extends the original fetch with entitlement columns so the tour can skip
  // the upgrade step for Pro users (isPro() is a pure client-side check).
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
        setIsProUser(null);
        setAuthResolved(true);
        return;
      }

      setUserId(user.id);
      const [{ data }, { data: card }] = await Promise.all([
        supabase
          .from('profiles')
          .select('username, plan, is_exempt, pro_expires_at')
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
        setIsProUser(isPro(data));
        setAuthResolved(true);
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

  // ── Tour engine (driver.js) ────────────────────────────────────────────
  const { show, finish, stop } = useDriverTour({
    onTourEnd: (completed, lastIndex) => {
      const endedKind = kind;
      if (endedKind) {
        const list = endedKind === 'owner' ? ownerSteps : visitorSteps;
        const lastStep = list[lastIndex];
        track(completed ? 'tour_completed' : 'tour_skipped', {
          tour_kind: endedKind,
          last_step_id: lastStep?.id ?? null,
          last_step_index: lastIndex,
        });
        if (endedKind === 'owner' && userId) {
          void markProductTourSeen(userId);
        }
        if (endedKind === 'visitor') markVisitorTourSeen();
      }
      requestCardFlip(false); // restore the card's front face
      setKind(null);
      setStepIndex(0);
      setStage('hidden');
    },
  });

  /** Resolve a step's semantic route to a real path. Card-less users do
   *  step 1 on /onboarding; card-holders see their card on the profile. */
  const resolveOwnerDestination = useCallback(
    (step: OnboardingStep): string | null => {
      const route: TourRoute =
        step.id === 'identity-card' && !hasCard
          ? 'onboarding'
          : (step.route ?? 'profile');
      if (route === 'onboarding') return '/onboarding';
      if (route === 'referral') return '/referral';
      if (!username) return null;
      switch (route) {
        case 'edit':
          return `/${username}/edit`;
        case 'analytics':
          return `/${username}/analytics`;
        case 'konneqts':
          return `/${username}/konneqts`;
        case 'showcase':
          return `/${username}/showcase`;
        default:
          return `/${username}`;
      }
    },
    [hasCard, username],
  );

  /** Shared by popover buttons and arrow keys. Ref keeps the touring effect
   *  deps limited to real state (no helper churn re-triggering steps). */
  const advance = useCallback(
    (dir: 1 | -1) => {
      const list = kind === 'owner' ? ownerSteps : visitorSteps;
      const next = stepIndex + dir;
      if (next >= list.length) {
        finish(); // last step → completed → onTourEnd(true, …)
        return;
      }
      setStepIndex(Math.max(0, next));
    },
    [kind, ownerSteps, visitorSteps, stepIndex, finish],
  );

  const startOwnerTour = useCallback(
    (trigger: TourTrigger) => {
      track('tour_started', { tour_kind: 'owner', trigger });
      setKind('owner');
      setStepIndex(0);
      setStage('touring');
    },
    [track],
  );

  const startVisitorTour = useCallback(
    (trigger: TourTrigger) => {
      // Showcase step only applies when the owner actually has items —
      // detect via the trigger rendered on the card page.
      const hasShowcase = Boolean(
        document.querySelector('[data-tour="showcase-trigger"]'),
      );
      setVisitorSteps(
        VISITOR_TOUR_STEPS.filter(
          (s) => !s.onlyWhenShowcase || hasShowcase,
        ),
      );
      track('tour_started', { tour_kind: 'visitor', trigger });
      setKind('visitor');
      setStepIndex(0);
      setStage('touring');
    },
    [track],
  );

  /** Latest render-scoped helpers for effects that must stay lean. Updated
   *  in an effect (not during render) per react-hooks/refs. */
  const helpersRef = useRef({ advance, track, resolveOwnerDestination });
  useEffect(() => {
    helpersRef.current = { advance, track, resolveOwnerDestination };
  });

  // ── The touring loop ───────────────────────────────────────────────────
  // For each step: flip the card if asked → navigate to the step's route →
  // wait for the target element to mount → spotlight it with driver.js.
  // Re-runs naturally as pathname/steps/user state settle.
  useEffect(() => {
    if (stage !== 'touring' || !kind) return;
    // Owner tours need the profile loaded (username drives navigation); the
    // visitor tour runs on the current page so it can start immediately.
    if (kind === 'owner' && (!userId || username === null || hasCard === null))
      return;

    const list = kind === 'owner' ? ownerSteps : visitorSteps;
    const step = list[stepIndex];
    if (!step) return;

    let cancelled = false;
    const { advance, track, resolveOwnerDestination } = helpersRef.current;

    void (async () => {
      // 1. Show the card face the step talks about.
      if ('flip' in step && step.flip) requestCardFlip(true);
      else if ('unflip' in step && step.unflip) requestCardFlip(false);

      // 2. Navigate (owner tour only — visitor steps all live on one page).
      if (kind === 'owner') {
        const destination = resolveOwnerDestination(step);
        if (destination && pathname !== destination) {
          router.push(destination);
          return; // effect re-runs once pathname settles
        }
      }

      // 3. Wait for the spotlight target, then render the popover.
      if (!step.target) return;
      const selector = `[data-tour="${step.target}"]`;
      const el = await waitForElement(selector);
      if (cancelled) return;
      if (!el) {
        // Target never mounted (unexpected layout change) — hop forward
        // instead of stalling behind a blank overlay.
        console.warn(`[tour] target missing, skipping step "${step.id}"`);
        advance(1);
        return;
      }
      show(
        {
          element: selector,
          title: step.title,
          description: step.description,
          side: step.side,
          align: step.align,
        },
        {
          index: stepIndex,
          total: list.length,
          onNext: () => advance(1),
          onPrev: () => advance(-1),
          onSkip: () => stop(),
        },
      );
      track('tour_step_viewed', {
        tour_kind: kind,
        step_id: step.id,
        step_index: stepIndex,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    stage,
    kind,
    stepIndex,
    pathname,
    userId,
    username,
    hasCard,
    isProUser,
    ownerSteps,
    visitorSteps,
    router,
    show,
    stop,
  ]);

  // ── Entry points ───────────────────────────────────────────────────────
  // Sidenav "Product Tour" button (owners). Works from ANY route now — the
  // touring loop navigates to the first step's destination itself.
  useEffect(() => {
    const open = () => startOwnerTour('sidenav');
    window.addEventListener(OPEN_PRODUCT_TOUR_EVENT, open);
    return () => window.removeEventListener(OPEN_PRODUCT_TOUR_EVENT, open);
  }, [startOwnerTour]);

  // "?" help button next to the card actions (visitors).
  useEffect(() => {
    const open = () => startVisitorTour('help-button');
    window.addEventListener(OPEN_VISITOR_TOUR_EVENT, open);
    return () => window.removeEventListener(OPEN_VISITOR_TOUR_EVENT, open);
  }, [startVisitorTour]);

  // First-time owners get the welcome card on their own app pages.
  useEffect(() => {
    if (!canShowTour || !userId) return;
    hasSeenProductTour(userId).then((seen) => {
      if (!seen) setStage((s) => (s === 'hidden' ? 'welcome' : s));
    });
  }, [canShowTour, userId]);

  // First-time visitors get one welcome card per browser, after the card has
  // actually rendered (the flip button is the marker for "card page ready").
  useEffect(() => {
    if (!authResolved || userId || stage !== 'hidden') return;
    if (!isPublicCardRoute(pathname) || hasSeenVisitorTour()) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void waitForElement('[data-tour="flip-card"]', 5000).then((el) => {
        if (!cancelled && el) setStage('visitor-welcome');
      });
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authResolved, userId, stage, pathname]);

  // NOTE: a welcome card that outlives its route (user navigated away) is
  // handled in the render gate below via canShowTour / isPublicCardRoute —
  // no state reset effect needed (avoids setState-in-effect cascades).

  // ── Keyboard (driver's own arrows assume multi-step lists) ─────────────
  useEffect(() => {
    if (stage !== 'touring') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stop();
        return;
      }
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (inField) return; // don't hijack typing
      if (e.key === 'ArrowRight') helpersRef.current.advance(1);
      else if (e.key === 'ArrowLeft') helpersRef.current.advance(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, stop]);
  // ── Render — welcome cards only; touring is rendered by driver.js ─────
  const showOwnerWelcome = stage === 'welcome' && canShowTour;
  const showVisitorWelcome =
    stage === 'visitor-welcome' && isPublicCardRoute(pathname);
  if (stage === 'hidden' || stage === 'touring') return null;
  if (!showOwnerWelcome && !showVisitorWelcome) return null;

  /** Dismissing the welcome card counts as "seen" — don't re-ask later. */
  const dismissWelcome = () => {
    if (showOwnerWelcome && userId) void markProductTourSeen(userId);
    if (showVisitorWelcome) markVisitorTourSeen();
    setStage('hidden');
  };

  const beginTour = () => {
    if (showVisitorWelcome) startVisitorTour('auto');
    else startOwnerTour('auto');
  };

  return (
    <div
      className="pointer-events-none fixed inset-0 z-100 flex items-start justify-end bg-black/50 px-2 py-2 sm:px-4 sm:py-4"
      role="presentation"
    >
      <AnimatePresence mode="wait">
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
            {showVisitorWelcome
              ? 'New to Konneqta cards?'
              : 'Welcome to Konneqta'}
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300">
            {showVisitorWelcome
              ? 'Want a 30-second tour of this card? See how to flip it, save the contact and connect.'
              : 'Want a quick walkthrough on setting up your digital identity card and getting the most out of Konneqta? It only takes a minute.'}
          </p>
          <div className="mt-3 sm:mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={dismissWelcome}
              className="rounded-lg px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={beginTour}
              className="rounded-lg px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--main-orange)' }}
            >
              Continue
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

