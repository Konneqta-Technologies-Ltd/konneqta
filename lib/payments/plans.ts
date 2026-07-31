






  /**
   * Payment plans.
   *
   * Each key is the canonical plan identifier that flows end-to-end:
   *   - inserted into `payments.payment_type` (DB check constraint must allow it)
   *   - written into `subscriptions.plan`
   *   - used to build the Flutterwave `tx_ref`
   *   - looked up here at fulfilment time to compute expiry by cycle
   *
   * Plan families:
   *   • Pro (individual)   → `monthly` / `yearly`           ← live, in the UI
   *   • Teams (future)      → `monthly_team_subscription` /
   *                           `yearly_team_subscription`     ← NOT in the UI yet
   *
   * The Teams keys are cycle-prefixed on purpose so the same downstream logic
   * (subscriptions.plan uniqueness, expiry-by-cycle, tx_ref) works unchanged
   * when Teams launches. No code/UI change will be needed beyond surfacing a
   * button — just wire the new key into PaymentOptionsModal when ready.
   *
   * `environmentPlanId` holds the Flutterwave Payment Plan ID used for
   * RECURRING (auto-renew) billing. Monthly and yearly need SEPARATE plans in
   * Flutterwave (different amount + interval), so they read separate env vars:
   *   - FLW_PRO_PLAN_ID_MONTHLY
   *   - FLW_PRO_PLAN_ID_YEARLY
   *
   * Backwards-compat: if only the old `FLW_PRO_PLAN_ID` is set, both cycles
   * fall back to it (so nothing breaks during rollout — though yearly recurring
   * would charge the monthly amount until the yearly plan is created).
   *
   * For ONE-TIME payments, `environmentPlanId` is ignored entirely (see
   * payment-service.ts → `paymentPlan` is only set when recurring = true).
   */
  export const PAYMENT_PLANS = {
    // ── Pro (individual) — live ──
    monthly: {
      id: "premium_upgrade_monthly",
      name: "Monthly Plan",
      amount: 950, // ◄ Charged on Month 1
      cycle: "monthly",
      currency: "NGN",
      description: "Your Konneqta Premium subscription",
      environmentPlanId:
        process.env.FLW_PRO_PLAN_ID_MONTHLY ?? process.env.FLW_PRO_PLAN_ID,
    },

    yearly: {
      id: "premium_upgrade_yearly",
      name: "Yearly Plan",
      amount: 9500, // ◄ Charged on Year 1
      cycle: "yearly",
      currency: "NGN",
      description: "Your Konneqta Premium subscription",
      environmentPlanId:
        process.env.FLW_PRO_PLAN_ID_YEARLY ?? process.env.FLW_PRO_PLAN_ID,
    },

    // ── Konneqta Teams (NOT yet exposed in the UI) ──
    // Cycle-prefixed keys mirror the Pro plans so the same downstream logic
    // works when Teams launches. Amounts are placeholders until pricing is
    // finalised. No button/option renders these yet.
    monthly_team_subscription: {
      name: "Konneqta Teams (Monthly)",
      amount: 5000, // Placeholder — update before launching Teams
      cycle: "monthly",
      currency: "NGN",
      description: "Your Konneqta Teams subscription",
    },

    yearly_team_subscription: {
      name: "Konneqta Teams (Yearly)",
      amount: 50000, // Placeholder — update before launching Teams
      cycle: "yearly",
      currency: "NGN",
      description: "Your Konneqta Teams subscription",
    },
  } as const;

  export type PaymentType = keyof typeof PAYMENT_PLANS;
