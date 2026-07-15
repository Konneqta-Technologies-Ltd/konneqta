import {
  FlutterwaveInitializeResponse,
  FlutterwaveSubscriptionResponse,
  FlutterwaveVerifyResponse,
  InitializePaymentParams,
} from "./types";

const BASE_URL = "https://api.flutterwave.com/v3";

/**
 * Resolve the Flutterwave secret key at call-time (not import-time).
 *
 * Returning a structured error instead of throwing at module load means a
 * missing key only affects the single payment request that needs it, not the
 * entire server boot / every route that transitively imports this module.
 */
function getSecretKey(): string {
  // Prefer the canonical name. Keep a fallback to the legacy TEST name so the
  // app keeps working if the operator hasn't renamed the env var yet.
  const key =
    process.env.FLW_SECRET_KEY ??
    process.env.FLWSECK_TEST ??
    null;

  if (!key) {
    throw new Error(
      "Missing FLW_SECRET_KEY environment variable. Add it to .env.local."
    );
  }

  return key;
}

export async function initializePayment({
  txRef,
  amount,
  currency,
  customer,
  paymentPlan,
}: InitializePaymentParams) {
  const secretKey = getSecretKey();

  // Build the request body. When `paymentPlan` is set, Flutterwave treats
  // this as a recurring charge linked to the Payment Plan — it will
  // automatically re-charge the user's card at the plan's interval.
  const requestBody: Record<string, unknown> = {
    tx_ref: txRef,
    amount,
    currency,
    redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment/callback`,
    customer,
    customizations: {
      title: "Konneqta",
      description: "Konneqta Premium",
    },
  };

  if (paymentPlan) {
    requestBody.payment_plan = paymentPlan;
  }

  const response = await fetch(`${BASE_URL}/payments`, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },

    body: JSON.stringify(requestBody),
  });

  const data =
    (await response.json()) as FlutterwaveInitializeResponse;

  return data;
}

export async function verifyTransaction(transactionId: number) {
  const secretKey = getSecretKey();

  const response = await fetch(
    `${BASE_URL}/transactions/${transactionId}/verify`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    }
  );

  const data =
    (await response.json()) as FlutterwaveVerifyResponse;

  return data;
}

// ── Subscription management ──────────────────────────────────────────────

/**
 * Fetch a subscription's details from Flutterwave by its subscription ID.
 * Used during verification to sync the latest state (next charge date, status).
 *
 * Flutterwave API: GET /v3/subscriptions/:id
 */
export async function getSubscription(
  subscriptionId: number
): Promise<FlutterwaveSubscriptionResponse> {
  const secretKey = getSecretKey();

  const response = await fetch(`${BASE_URL}/subscriptions/${subscriptionId}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  return (await response.json()) as FlutterwaveSubscriptionResponse;
}

/**
 * Cancel a subscription in Flutterwave.
 *
 * Flutterwave API: PUT /v3/subscriptions/:id/cancel
 *
 * NOTE: Flutterwave cancels immediately by default. The user keeps access
 * until current_period_end (we track that locally).
 */
export async function cancelSubscription(
  subscriptionId: number
): Promise<{ status: string; message: string }> {
  const secretKey = getSecretKey();

  const response = await fetch(
    `${BASE_URL}/subscriptions/${subscriptionId}/cancel`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    }
  );

  const data = await response.json();
  return {
    status: data.status,
    message: data.message ?? "Unknown response from Flutterwave.",
  };
}

/**
 * Get all subscriptions for a customer by their Flutterwave customer ID.
 * Useful for looking up an existing subscription during verification.
 *
 * Flutterwave API: GET /v3/subscriptions?customer_email=:email
 */
export async function getSubscriptionsByEmail(
  email: string
): Promise<FlutterwaveSubscriptionResponse> {
  const secretKey = getSecretKey();

  const response = await fetch(
    `${BASE_URL}/subscriptions?customer_email=${encodeURIComponent(email)}`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    }
  );

  return (await response.json()) as FlutterwaveSubscriptionResponse;
}
