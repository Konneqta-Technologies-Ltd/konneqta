import {
  FlutterwaveInitializeResponse,
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
}: InitializePaymentParams) {
  const secretKey = getSecretKey();

  const response = await fetch(`${BASE_URL}/payments`, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      tx_ref: txRef,

      amount,

      currency,

      redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment/callback`,

      customer,

      customizations: {
        title: "Konneqta",
        description: "Konneqta Premium",
      },
    }),
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