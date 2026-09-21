/**
 * Konneqt request fulfilment (server-only).
 *
 * Shared by:
 *   - POST /api/konneqts           (reverse-pending auto-accept: the caller
 *                                   clicks Connect on someone who already
 *                                   requested them → mutual intent → connect)
 *   - POST /api/konneqts/requests/respond  (the recipient's explicit
 *                                   Accept/Reject from the notification panel)
 *
 * Accept side effects (mirroring the pre-request instant-connect flow):
 *   1. Insert the ONE relationship row into `konneqts`
 *      (user_a = original requester, user_b = accepter). A 23505 unique
 *      violation is treated as success — the pair is already connected.
 *   2. Mark the request accepted (+ responded_at).
 *   3. Notify the requester (in-app + push, preference-aware, non-fatal).
 *   4. Owner-scoped `konneqt` analytics events for BOTH participants.
 *   5. PostHog funnel events.
 *   6. Stamp the accepter's konneqt_request notification row(s) so the
 *      Accept/Reject buttons disappear on every device.
 *
 * Reject side effects: mark the request rejected + stamp the notification
 * row(s). No notification is sent to the requester (deliberate — softer UX).
 */

import { getAdminClient, recordEvent } from "@/lib/analytics/server";
import { createNotification } from "@/lib/notifications/server";
import { getSessionId } from "@/lib/analytics/session";
import { getVisitorId } from "@/lib/analytics/visitor";
import { captureEvent } from "@/lib/posthog";

/** The slice of a konneqt_requests row both callers already have. */
export interface KonneqtRequestRow {
  id: string;
  requester_id: string;
  recipient_id: string;
  source: string;
}

export type AcceptResult = { ok: true } | { ok: false; error: string };

/** Human display name for notifications — full name, else @username, else fallback. */
function displayName(
  p: { full_name: string | null; username: string | null } | null,
  fallback: string,
): string {
  return (
    p?.full_name?.trim() || (p?.username ? `@${p.username}` : fallback)
  );
}

/**
 * Stamp every konneqt_request notification for this request as resolved, so
 * the Accept/Reject buttons settle into a static chip on all the recipient's
 * devices. Best-effort — never fails the accept/reject.
 */
async function stampRequestNotifications(
  requestId: string,
  recipientId: string,
  status: "accepted" | "rejected",
): Promise<void> {
  try {
    const admin = getAdminClient();
    const { data: rows } = await admin
      .from("notifications")
      .select("id, data")
      .eq("user_id", recipientId)
      .eq("type", "konneqt_request")
      .contains("data", { requestId });

    for (const row of rows ?? []) {
      void admin
        .from("notifications")
        .update({ data: { ...(row.data ?? {}), requestStatus: status } })
        .eq("id", row.id);
    }
  } catch (err) {
    console.warn(
      "[konneqts/server] stamp notifications failed (non-fatal):",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function acceptKonneqtRequest(
  request: KonneqtRequestRow,
): Promise<AcceptResult> {
  const admin = getAdminClient();

  // 1. The relationship row (unique pair index is the hard dedupe).
  const { error: insertError } = await admin.from("konneqts").insert({
    user_a: request.requester_id,
    user_b: request.recipient_id,
    source: request.source,
  });
  if (insertError && insertError.code !== "23505") {
    console.error("[konneqts/server] konneqts insert failed:", insertError.message);
    return { ok: false, error: "Could not create the connection. Please try again." };
  }

  // 2. Resolve the request.
  const { error: updateError } = await admin
    .from("konneqt_requests")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", request.id)
    .eq("status", "pending");
  if (updateError) {
    console.error("[konneqts/server] request update failed:", updateError.message);
    return { ok: false, error: "Could not accept the request. Please try again." };
  }

  // 3. Profiles + primary cards for names, links and analytics scoping.
  const [profilesRes, requesterCardRes, recipientCardRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, username, full_name")
      .in("id", [request.requester_id, request.recipient_id]),
    admin
      .from("cards")
      .select("id")
      .eq("owner_id", request.requester_id)
      .eq("is_primary", true)
      .maybeSingle(),
    admin
      .from("cards")
      .select("id")
      .eq("owner_id", request.recipient_id)
      .eq("is_primary", true)
      .maybeSingle(),
  ]);

  const requester =
    profilesRes.data?.find((p) => p.id === request.requester_id) ?? null;
  const recipient =
    profilesRes.data?.find((p) => p.id === request.recipient_id) ?? null;

  // 4. Owner-scoped analytics events for BOTH participants (one row per
  // owner's event — same pattern as the old instant-connect flow).
  const [visitorId, sessionId] = await Promise.all([
    getVisitorId(),
    getSessionId(),
  ]);
  void recordEvent({
    owner_id: request.requester_id,
    card_id: requesterCardRes.data?.id ?? null,
    event_type: "konneqt",
    source: request.source,
    visitor_id: visitorId,
    session_id: sessionId,
  });
  void recordEvent({
    owner_id: request.recipient_id,
    card_id: recipientCardRes.data?.id ?? null,
    event_type: "konneqt",
    source: request.source,
    visitor_id: visitorId,
    session_id: sessionId,
  });

  // 5. Tell the requester the good news (their own Konneqts page).
  void createNotification({
    userId: request.requester_id,
    type: "konneqt",
    title: `${displayName(recipient, "Someone")} accepted your Konneqt request`,
    body: "You're now connected — find them in your Konneqts.",
    link: requester?.username ? `/${requester.username}/konneqts` : null,
  });

  // PostHog funnel events (best-effort).
  void captureEvent(request.recipient_id, "konneqt_created", {
    target: requester?.username ?? "unknown",
    source: request.source,
    via: "request_accepted",
  }).catch(() => {});
  void captureEvent(request.requester_id, "konneqt_request_accepted", {
    by: recipient?.username ?? "unknown",
  }).catch(() => {});

  // 6. Settle the accepter's notification row(s).
  await stampRequestNotifications(request.id, request.recipient_id, "accepted");

  return { ok: true };
}

export async function rejectKonneqtRequest(
  request: KonneqtRequestRow,
): Promise<AcceptResult> {
  const admin = getAdminClient();

  const { error: updateError } = await admin
    .from("konneqt_requests")
    .update({ status: "rejected", responded_at: new Date().toISOString() })
    .eq("id", request.id)
    .eq("status", "pending");

  if (updateError) {
    console.error("[konneqts/server] request reject failed:", updateError.message);
    return { ok: false, error: "Could not reject the request. Please try again." };
  }

  // No notification to the requester (deliberate — softer UX). Just settle
  // the recipient's own notification row(s).
  await stampRequestNotifications(request.id, request.recipient_id, "rejected");

  return { ok: true };
}

