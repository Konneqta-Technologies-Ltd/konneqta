






  /**
   * Payment plans.
   *
   * Each key is the canonical plan identifier that flows end-to-end:
   *   - inserted into `payments.payment_type` (DB check constraint must allow it)
   *   - written into `subscriptions.plan`
   *   - used to build the Flutterwave `tx_ref`
   *   - looked up here at fulfilment time to compute expiry by cycle
   *
   * Plan families (this repo ships WEB pricing only):
   *   • Pro → `monthly` / `yearly` — each cycle carries per-currency
   *     VARIANTS (NGN + USD). `payment_type` identifies the PRODUCT; the
   *     `payments.currency` column identifies the currency. Never suffix
   *     payment types with a currency.
   *
   * NOTE: Konneqta Teams payment keys are deliberately NOT defined here —
   * this web app ships no Teams checkout. Teams remains ALLOWED at the DB
   * level (payments.payment_type check constraint) because Teams will be
   * implemented against this database by another client.
   *
   * Each variant's `environmentPlanId` holds the Flutterwave Payment Plan ID
   * used for RECURRING (auto-renew) billing. NGN and USD need SEPARATE plans
   * (different amount AND currency), so they read separate env vars:
   *   - FLW_PRO_PLAN_ID_MONTHLY       (NGN)
   *   - FLW_PRO_PLAN_ID_YEARLY        (NGN)
   *   - FLW_PRO_PLAN_ID_MONTHLY_USD   (USD)
   *   - FLW_PRO_PLAN_ID_YEARLY_USD    (USD)
   *
   * Backwards-compat: NGN variants fall back to the legacy `FLW_PRO_PLAN_ID`
   * if the per-cycle var is unset. USD variants have NO fallback on purpose —
   * the legacy ID is an NGN plan — and payment-service.ts refuses USD
   * sessions when their plan ID is unset (a USD charge must never silently
   * degrade to a one-time payment).
   *
   * For ONE-TIME payments, `environmentPlanId` is ignored entirely (see
   * payment-service.ts → `paymentPlan` is set when recurring = true, or
   * always for USD).
   */
  export const PAYMENT_PLANS = {
    // ── Pro (individual) — live ──
    // `payment_type` identifies the PRODUCT (monthly/yearly); the
    // `payments.currency` column identifies the currency. Each cycle carries
    // per-currency VARIANTS — never suffix payment types with a currency.
    monthly: {
      id: "monthly",
      name: "Monthly Plan",
      cycle: "monthly",
      description: "Your Konneqta Premium subscription",
      variants: {
        NGN: {
          amount: 950, // ◄ Charged on Month 1
          currency: "NGN",
          environmentPlanId:
            process.env.FLW_PRO_PLAN_ID_MONTHLY ?? process.env.FLW_PRO_PLAN_ID,
        },
        USD: {
          amount: 0.99, // ◄ Charged on Month 1 — card auto-renew ONLY
          currency: "USD",
          // NO fallback to FLW_PRO_PLAN_ID: that legacy ID is an NGN plan,
          // and attaching it to a USD session would start an NGN renewal.
          environmentPlanId: process.env.FLW_PRO_PLAN_ID_MONTHLY_USD,
        },
      },
    },

    yearly: {
      id: "yearly",
      name: "Yearly Plan",
      cycle: "yearly",
      description: "Your Konneqta Premium subscription",
      variants: {
        NGN: {
          amount: 9500, // ◄ Charged on Year 1
          currency: "NGN",
          environmentPlanId:
            process.env.FLW_PRO_PLAN_ID_YEARLY ?? process.env.FLW_PRO_PLAN_ID,
        },
        USD: {
          amount: 9.99, // ◄ Charged on Year 1 — card auto-renew ONLY
          currency: "USD",
          environmentPlanId: process.env.FLW_PRO_PLAN_ID_YEARLY_USD,
        },
      },
    },
  } as const;

  export type PaymentType = keyof typeof PAYMENT_PLANS;

  /** Currency variants available for every plan cycle. */
  export type Currency = "NGN" | "USD";
