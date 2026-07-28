#!/usr/bin/env node

/**
 * create-flw-plan.mjs — One-time script to create Flutterwave Payment Plans.
 *
 * A Payment Plan tells Flutterwave to automatically re-charge the user's card
 * at the plan's interval (monthly or yearly). You only run this ONCE per
 * environment (test + live), per cycle.
 *
 * The returned `id`s are your Payment Plan IDs — put them in .env.local as:
 *   FLW_PRO_PLAN_ID_MONTHLY=<id from the monthly plan>
 *   FLW_PRO_PLAN_ID_YEARLY=<id from the yearly plan>
 *
 * USAGE:
 *   node scripts/create-flw-plan.mjs            # creates BOTH monthly + yearly
 *   node scripts/create-flw-plan.mjs monthly    # creates only the monthly plan
 *   node scripts/create-flw-plan.mjs yearly     # creates only the yearly plan
 *
 * PREREQUISITES:
 *   - FLW_SECRET_KEY must be set in .env.local (or exported in your shell).
 *     Use a TEST key (FLWSECK_TEST-...) while testing, and a LIVE key when
 *     going to production.
 *
 * WHAT IT DOES:
 *   1. Calls POST https://api.flutterwave.com/v3/payment-plans for each cycle
 *   2. Creates "Konneqta Pro Monthly" at ₦950/month and
 *      "Konneqta Pro Yearly" at ₦9,500/year
 *   3. Prints the plan IDs to copy into your .env.local
 *
 * To verify what exists:
 *   GET https://api.flutterwave.com/v3/payment-plans
 *   (with Authorization: Bearer <your-secret-key>)
 */

const BASE_URL = "https://api.flutterwave.com/v3";

// ── Plan configuration ────────────────────────────────────────────────────
// These MUST match lib/payments/plans.ts (PAYMENT_PLANS.monthly / .yearly).
const PLANS = {
  monthly: {
    amount: 950, // ₦950/month — matches PAYMENT_PLANS.monthly.amount
    name: "Konneqta Pro Monthly",
    interval: "monthly", // 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
    duration: 0, // 0 = indefinite (recurring until cancelled)
    currency: "NGN",
    envVar: "FLW_PRO_PLAN_ID_MONTHLY",
  },
  yearly: {
    amount: 9500, // ₦9,500/year — matches PAYMENT_PLANS.yearly.amount
    name: "Konneqta Pro Yearly",
    interval: "yearly",
    duration: 0, // 0 = indefinite (recurring until cancelled)
    currency: "NGN",
    envVar: "FLW_PRO_PLAN_ID_YEARLY",
  },
};

/**
 * Create a single Payment Plan on Flutterwave.
 * Returns the plan id on success, throws on failure.
 */
async function createPlan(secretKey, config) {
  const response = await fetch(`${BASE_URL}/payment-plans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });

  const data = await response.json();

  if (data.status !== "success") {
    throw new Error(
      `Failed to create "${config.name}": ${JSON.stringify(data)}`
    );
  }

  return data.data;
}

/** List all existing Payment Plans on the account (for reference). */
async function listPlans(secretKey) {
  const response = await fetch(`${BASE_URL}/payment-plans`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await response.json();
  return data.status === "success" && Array.isArray(data.data) ? data.data : [];
}

async function main() {
  const secretKey = process.env.FLW_SECRET_KEY;

  if (!secretKey) {
    console.error(
      "❌ FLW_SECRET_KEY is not set. Add it to .env.local or export it in your shell."
    );
    process.exit(1);
  }

  // Decide which plans to create based on CLI args.
  const arg = process.argv[2]?.toLowerCase();
  const cyclesToCreate =
    arg === "monthly" || arg === "yearly"
      ? [arg]
      : ["monthly", "yearly"];

  console.log(`\n🔑 Using secret key: ${secretKey.slice(0, 8)}...${secretKey.slice(-4)}`);
  console.log(`📦 Creating plan(s): ${cyclesToCreate.join(", ")}\n`);

  const created = {};

  for (const cycle of cyclesToCreate) {
    const config = PLANS[cycle];
    console.log(`🔄 Creating "${config.name}"...`);
    console.log(`   Amount: ${config.currency} ${config.amount}`);
    console.log(`   Interval: ${config.interval}`);

    try {
      const plan = await createPlan(secretKey, config);
      created[cycle] = plan.id;

      console.log(`✅ Created successfully!`);
      console.log(`   Plan ID: ${plan.id}`);
      console.log(`   Status: ${plan.status}\n`);
    } catch (err) {
      console.error(`❌ ${err.message}\n`);
    }
  }

  // ── Print the .env.local snippet ──
  if (Object.keys(created).length > 0) {
    console.log("─────────────────────────────────────────────────────────");
    console.log("NEXT STEP: Add these to your .env.local:\n");
    for (const [cycle, id] of Object.entries(created)) {
      console.log(`   ${PLANS[cycle].envVar}=${id}`);
    }
    console.log("─────────────────────────────────────────────────────────\n");
  }

  // ── List all plans for reference ──
  console.log("📋 All your Payment Plans on this account:");
  try {
    const allPlans = await listPlans(secretKey);
    if (allPlans.length === 0) {
      console.log("   (none)");
    }
    for (const plan of allPlans) {
      console.log(
        `   ID: ${plan.id} | ${plan.name} | ${plan.amount} ${plan.currency} | ${plan.interval} | ${plan.status}`
      );
    }
  } catch (err) {
    console.warn(`   Could not list plans: ${err.message}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});