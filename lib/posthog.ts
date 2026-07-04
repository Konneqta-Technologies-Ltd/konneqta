import { PostHog } from "posthog-node";

/**
 * Server-side PostHog client (singleton).
 *
 * Used in Route Handlers and Server Actions to capture events from the server
 * (e.g., account_deleted, user_signed_up). The project key is safe to expose
 * client-side (NEXT_PUBLIC_), but this client runs server-side only.
 *
 * Lifecycle: PostHog recommends flushing before the process exits. In
 * serverless (Vercel), each invocation is short-lived, so we flush after
 * each capture call via `posthog.flush()`.
 */
let client: PostHog | null = null;

export function getPostHog(): PostHog {
  if (!client) {
    client = new PostHog(
      process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!,
      {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
        flushAt: 1, // Flush immediately in serverless environments
      }
    );
  }
  return client;
}

/**
 * Convenience wrapper: capture + flush (for serverless).
 * Use this in route handlers / server actions.
 */
export async function captureEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  const posthog = getPostHog();
  posthog.capture({ distinctId, event, properties });
  await posthog.flush();
}