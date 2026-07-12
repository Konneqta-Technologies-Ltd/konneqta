






export const PAYMENT_PLANS = {
  premium_upgrade: {
    name: "Konneqta Pro",
    amount: 2850, 
      currency: "NGN",
    description: "Upgrade your Konneqta account to Pro",
  },

  team_subscription: {
    name: "Konneqta Teams",
    amount: 2000, // Placeholder for now
      currency: "NGN",
    description: "Your Konneqta Teams subscription",
  },
} as const;

export type PaymentType = keyof typeof PAYMENT_PLANS;