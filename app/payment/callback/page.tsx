"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Link from "next/link";

/**
 * Payment callback page.
 *
 * Flutterwave redirects here after the checkout modal closes with query params:
 *   - status=successful|cancelled|failed
 *   - transaction_id=12345
 *   - tx_ref=KONN_...
 *
 * We call our /api/payments/verify route to verify server-side (fast path).
 * The webhook remains the source of truth.
 */
function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [result, setResult] = useState<"success" | "failed" | "cancelled">(
    "failed"
  );

  const status = searchParams.get("status");
  const transactionId = searchParams.get("transaction_id");
  const txRef = searchParams.get("tx_ref");

  const hasTransaction = Boolean(transactionId && txRef);

  useEffect(() => {
    // If there's no transaction ID, nothing to verify — derive the result
    // from the redirect status param without a server call.
    if (!transactionId || !txRef) {
      return;
    }

    let cancelled = false;

    // Call our verify route to confirm with Flutterwave + grant Pro.
    fetch("/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: Number(transactionId), txRef }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.data?.status === "successful") {
          setResult("success");
        } else if (status === "cancelled") {
          setResult("cancelled");
        } else {
          setResult("failed");
        }
      })
      .catch(() => {
        if (!cancelled) setResult("failed");
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId, txRef]);

  // If no transaction to verify, we can compute the state synchronously.
  const effectiveVerifying = verifying && hasTransaction;

  // ---- Loading state ----
  if (effectiveVerifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-zinc-300 border-t-blue-600" />
          <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Verifying your payment…
          </p>
            <p className="mt-1 text-sm text-zinc-500">
            Please keep this page open.
          </p>
        </div>
      </div>
    );
  }

  // When there's no transaction, infer the result from the status param.
  const finalResult = hasTransaction
    ? result
    : status === "cancelled"
      ? "cancelled"
      : "failed";

  // ---- Result states ----
  const isSuccess = finalResult === "success";
  const isCancelled = finalResult === "cancelled";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md text-center">
        {isSuccess ? (
          <>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg
                className="h-10 w-10 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Payment Successful!
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Welcome to Konneqta Pro. Enjoy all the premium features!
            </p>
          </>
        ) : isCancelled ? (
          <>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
              <svg
                className="h-10 w-10 text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Payment Cancelled
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Your payment was cancelled. No charges were made.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <svg
                className="h-10 w-10 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Payment Failed
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Your payment could not be completed. Please try again.
            </p>
          </>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
          >
            Back to Home
          </Link>
          {!isSuccess && (
            <button
              onClick={() => router.back()}
              className="rounded-lg border border-zinc-300 px-6 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
          <div className="text-zinc-500">Loading…</div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}