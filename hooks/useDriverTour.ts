'use client';

import { useCallback, useEffect, useRef } from 'react';
import { driver, type Driver, type PopoverDOM } from 'driver.js';

export interface DriverTourStep {
  /** CSS selector of the element to spotlight. */
  element: string;
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

export interface DriverTourControls {
  /** 0-based index of the step being shown. */
  index: number;
  /** Total number of steps in THIS tour run (after condition filtering). */
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

/** Orange spotlight ring — same highlight look as the previous tour. */
const RING_CLASS = 'konneqta-tour-ring';

function makeButton(
  text: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = text;
  btn.className = className;
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Rebuilds driver.js's popover to look identical to the previous hand-rolled
 * tour card: restyled title/description, centered dot indicators with a
 * "X of N" counter, and a Skip | Previous + Next/Finish footer. driver.js
 * itself is used purely as the spotlight/positioning engine.
 */
function renderKonneqtaPopover(
  popover: PopoverDOM,
  controls: DriverTourControls,
) {
  // Hide driver.js chrome we replace (close button, footer, progress text).
  popover.closeButton.style.display = 'none';
  popover.footer.style.display = 'none';
  popover.progress.style.display = 'none';

  // Restyle title/description (driver fills in the text content).
  popover.title.className = 'konneqta-tour-title';
  popover.description.className = 'konneqta-tour-desc';

  // Dots + step counter, centered under the description.
  const meta = document.createElement('div');
  meta.className = 'konneqta-tour-meta';

  const dots = document.createElement('div');
  dots.className = 'konneqta-tour-dots';
  for (let i = 0; i < controls.total; i++) {
    const dot = document.createElement('span');
    dot.className =
      i === controls.index ? 'konneqta-tour-dot is-active' : 'konneqta-tour-dot';
    dots.appendChild(dot);
  }

  const counter = document.createElement('span');
  counter.className = 'konneqta-tour-counter';
  counter.textContent = `${controls.index + 1} of ${controls.total}`;

  meta.append(dots, counter);
  popover.wrapper.insertBefore(meta, popover.footer);

  // Footer: Skip | Previous + Next/Finish (our buttons, wired to the widget).
  const footer = document.createElement('div');
  footer.className = 'konneqta-tour-footer';

  const right = document.createElement('div');
  right.className = 'konneqta-tour-footer-right';
  if (controls.index > 0) {
    right.appendChild(
      makeButton('Previous', 'konneqta-tour-btn-prev', controls.onPrev),
    );
  }
  right.appendChild(
    makeButton(
      controls.index === controls.total - 1 ? 'Finish' : 'Next',
      'konneqta-tour-btn-next',
      controls.onNext,
    ),
  );

  footer.append(
    makeButton('Skip', 'konneqta-tour-btn-skip', controls.onSkip),
    right,
  );
  popover.wrapper.appendChild(footer);
}
// __HOOK__
/**
 * Thin orchestration layer over driver.js.
 *
 * The widget drives ONE step per driver instance because tours span multiple
 * routes — driver.js can't navigate between pages. Each call to `show()`
 * destroys the previous instance (suppressing its end callback), creates a
 * fresh single-step instance with the Konneqta popover, and starts it.
 *
 * Keyboard: driver's own arrow handling assumes a multi-step list, which
 * breaks single-step instances, so it stays disabled — the widget handles
 * Escape / arrow keys itself. Overlay click still closes via driver
 * (`overlayClickBehavior: 'close'` → destroy → `onTourEnd(false, …)`).
 */
export function useDriverTour(options: {
  onTourEnd: (completed: boolean, lastIndex: number) => void;
}) {
  const driverRef = useRef<Driver | null>(null);
  const ringElRef = useRef<HTMLElement | null>(null);
  // Latest callback in a ref so `show()` stays referentially stable. Updated
  // in an effect (not during render) per react-hooks/refs.
  const endCbRef = useRef(options.onTourEnd);
  useEffect(() => {
    endCbRef.current = options.onTourEnd;
  });

  /** True while we destroy an instance to swap steps — don't fire onTourEnd. */
  const suppressEndRef = useRef(false);
  const completedRef = useRef(false);
  const lastIndexRef = useRef(0);

  const clearRing = useCallback(() => {
    ringElRef.current?.classList.remove(RING_CLASS);
    ringElRef.current = null;
  }, []);

  /** Spotlight one step. Call again for each subsequent step. */
  const show = useCallback(
    (step: DriverTourStep, controls: DriverTourControls) => {
      suppressEndRef.current = true;
      driverRef.current?.destroy();
      driverRef.current = null;
      clearRing();
      suppressEndRef.current = false;

      completedRef.current = false;
      lastIndexRef.current = controls.index;

      const instance = driver({
        animate: true,
        overlayColor: '#000000',
        overlayOpacity: 0.5,
        allowClose: true,
        // See hook doc: arrows would misbehave on single-step instances.
        allowKeyboardControl: false,
        overlayClickBehavior: 'close',
        stagePadding: 6,
        stageRadius: 12,
        smoothScroll: true,
        popoverClass: 'konneqta-tour-popover',
        popoverOffset: 12,
        steps: [
          {
            element: step.element,
            popover: {
              title: step.title,
              description: step.description,
              side: step.side,
              align: step.align,
              showButtons: [],
              showProgress: false,
              onPopoverRender: (popover) =>
                renderKonneqtaPopover(popover, controls),
            },
          },
        ],
        onHighlighted: (element) => {
          clearRing();
          if (element instanceof HTMLElement) {
            element.classList.add(RING_CLASS);
            ringElRef.current = element;
          }
        },
        onDestroyed: () => {
          clearRing();
          if (suppressEndRef.current) return;
          endCbRef.current(completedRef.current, lastIndexRef.current);
        },
      });

      driverRef.current = instance;
      instance.drive();
    },
    [clearRing],
  );

  /** User finished the last step — end callback reports completed = true. */
  const finish = useCallback(() => {
    completedRef.current = true;
    suppressEndRef.current = false;
    driverRef.current?.destroy();
    driverRef.current = null;
  }, []);

  /** Skip button / overlay click / Escape — end callback reports a skip. */
  const stop = useCallback(() => {
    completedRef.current = false;
    suppressEndRef.current = false;
    driverRef.current?.destroy();
    driverRef.current = null;
  }, []);

  // Unmount safety: tear down the driver and the ring without firing the
  // end callback (the widget unmounting means the tour context is gone).
  useEffect(
    () => () => {
      suppressEndRef.current = true;
      clearRing();
      driverRef.current?.destroy();
      driverRef.current = null;
    },
    [clearRing],
  );

  return { show, finish, stop };
}

/**
 * Resolves once the selector matches (polling — handles elements that mount
 * after a route change), or null after `timeoutMs`.
 */
export function waitForElement(
  selector: string,
  timeoutMs = 3000,
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const found = () => document.querySelector<HTMLElement>(selector);
    const existing = found();
    if (existing) {
      resolve(existing);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const el = found();
      if (el) {
        window.clearInterval(timer);
        resolve(el);
      } else if (Date.now() - startedAt > timeoutMs) {
        window.clearInterval(timer);
        resolve(null);
      }
    }, 100);
  });
}