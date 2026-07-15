#!/usr/bin/env node

/**
 * create-flw-plan.mjs — One-time script to create a Flutterwave Payment Plan.
 *
 * A Payment Plan tells Flutterwave to automatically re-charge the user's card
 * every month (or whatever interval you specify). You only run this ONCE.
 *
 * The returned `id` is your Payment Plan ID — put it in .env.local as
 * FLW_PRO_PLAN_ID.
 *
 * USAGE:
 *   node scripts/create-flw-plan.mjs
 *
 * PREREQUISITES:
 *   - FLW_SECRET_KEY must be set in .env.local (or exported in your shell)
 *
 * WHAT IT DOES:
 *   1. Calls POST https://api.flutterwave.com/v3/payment-plans
 *   2. Creates "Konneqta Pro Monthly" at ₦2,850/month
 *   3. Prints the plan ID to copy into your .env.local
 *
 * To verify it was created:
 *   GET https://api.flutterwave.com/v3/payment-plans
 *   (with Authorization: Bearer <your-secret-key>)
 */

const BASE_URL = "https://api.flutterwave.com/v3";

// ── Plan configuration ────────────────────────────────────────────────────
// These MUST match what's in lib/payments/plans.ts:
//   premium_upgrade: { amount: 2850, currency: "NGN" }
const PLAN_CONFIG = {
  amount: 2850, // ₦2,850/month — matches PAYMENT_PLANS.premium_upgrade.amount
  name: "Konneqta Pro Monthly",
  interval: "monthly", // 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
  duration: 0, // 0 = indefinite (recurring until cancelled)
  currency: "NGN",
};

async function main() {
  const secretKey = process.env.FLW_SECRET_KEY;

  if (!secretKey) {
    console.error(
      "❌ FLW_SECRET_KEY is not set. Add it to .env.local or export it in your shell.",
    );
    process.exit(1);
  }

  console.log(`\n🔄 Creating Flutterwave Payment Plan...`);
  console.log(`   Name: ${PLAN_CONFIG.name}`);
  console.log(`   Amount: ${PLAN_CONFIG.currency} ${PLAN_CONFIG.amount}`);
  console.log(`   Interval: ${PLAN_CONFIG.interval}\n`);

  const response = await fetch(`${BASE_URL}/payment-plans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(PLAN_CONFIG),
  });

  const data = await response.json();

  if (data.status !== "success") {
    console.error("❌ Failed to create Payment Plan:");
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const planId = data.data.id;

  console.log("✅ Payment Plan created successfully!\n");
  console.log(`   Plan ID: ${planId}`);
  console.log(`   Plan Name: ${data.data.name}`);
  console.log(`   Status: ${data.data.status}\n`);
  console.log("─────────────────────────────────────────────────────────");
  console.log("NEXT STEP: Add this to your .env.local:\n");
  console.log(`   FLW_PRO_PLAN_ID=${planId}`);
  console.log("─────────────────────────────────────────────────────────\n");

  // Also list all existing plans for reference
  console.log("📋 All your Payment Plans:");
  const listResponse = await fetch(`${BASE_URL}/payment-plans`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const listData = await listResponse.json();
  if (listData.status === "success" && listData.data) {
    for (const plan of listData.data) {
      console.log(
        `   ID: ${plan.id} | ${plan.name} | ${plan.amount} ${plan.currency} | ${plan.interval} | ${plan.status}`,
      );
    }
  }
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});