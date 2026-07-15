"use client";

import { PaymentType } from "@/lib/payments/plans";
import { useState } from "react";

declare global {
  interface Window {
    FlutterwaveCheckout: (config: {
      public_key: string;
      tx_ref: string;
      amount: number;
      currency: string;

      customer: {
        email: string;
        name: string;
        phone_number?: string;
      };

      customizations: {
        title: string;
        description: string;
      };

      payment_options: string;

      /** Flutterwave Payment Plan ID — enables recurring billing. */
      payment_plan?: number;

      callback: (response: { transaction_id: number }) => void;

      onclose: () => void;
    }) => void;
  }
}

/**
 * Hook for initiating a Flutterwave checkout.
 *
 * Flow:
 *  1. POST to /api/payments/create-session → creates a pending payment row +
 *     returns the session config (public key, tx_ref, amount, customer).
 *  2. Open the Flutterwave checkout modal via window.FlutterwaveCheckout().
 *  3. On the callback (modal close), call /api/payments/verify to confirm the
 *     transaction with Flutterwave server-side and grant Pro.
 *  4. Redirect to /payment/callback to show the result.
 *
 * The hook exposes `loading` and `error` so the calling button can show
 * feedback while the session is being created.
 */
export function useFlutterwavePayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async (paymentType: PaymentType, recurring: boolean = false) => {
    setLoading(true);
    setError(null);

    try {
      // 1. Create the payment session (server creates a pending payment row).
      //    `recurring` determines whether this is a card-only auto-renew
      //    subscription or a one-time payment (card/transfer/USSD).
      const response = await fetch("/api/payments/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentType,
          recurring,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to create payment session.");
      }

      const session = result.data;

      // Guard: ensure the Flutterwave script has loaded.
      if (typeof window.FlutterwaveCheckout !== "function") {
        throw new Error(
          "Flutterwave checkout script not loaded. Please refresh and try again."
        );
      }

      // 2. Open the Flutterwave checkout modal.
      window.FlutterwaveCheckout({
        public_key: session.publicKey,

        tx_ref: session.txRef,

        amount: session.amount,

        currency: session.currency,

        customer: session.customer,

        customizations: session.customizations,

        // Use the payment options from the session (card-only for recurring,
        // all methods for one-time).
        payment_options: session.paymentOptions,

        // Pass the Payment Plan ID for recurring billing.
        // Undefined for one-time payments (Flutterwave ignores it).
        ...(session.paymentPlan ? { payment_plan: session.paymentPlan } : {}),

        // 3. When the user completes payment in the modal, Flutterwave calls
        //    this with { transaction_id }. We redirect to the callback page,
        //    which verifies server-side.
        callback: (data) => {
          const transactionId = data?.transaction_id;
          const params = new URLSearchParams({
            tx_ref: session.txRef,
          });
          if (transactionId) {
            params.set("transaction_id", String(transactionId));
            params.set("status", "successful");
          }
          window.location.href = `/payment/callback?${params.toString()}`;
        },

        // If the user closes the modal without paying, redirect to callback
        // with cancelled status.
        onclose: () => {
          // Only redirect if no callback fired (callback handles success).
          // We use a small timeout so the callback (if it ran) takes precedence.
          setTimeout(() => {
            const params = new URLSearchParams({
              tx_ref: session.txRef,
              status: "cancelled",
            });
            window.location.href = `/payment/callback?${params.toString()}`;
          }, 100);
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      // Re-throw so the calling component can also react (e.g. show a toast).
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { pay, loading, error };
}