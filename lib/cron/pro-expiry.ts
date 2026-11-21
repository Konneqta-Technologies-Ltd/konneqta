import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  sendProExpiredEmail,
  sendProExpiryReminderEmail,
} from "@/lib/emails/zeptomail";

/**
 * Daily Pro-expiry notification job (shared logic for the cron route).
 *
 * Two emails per subscriber, each sent ONCE (dedupe via the
 * pro_reminder_sent_at / pro_expiry_notice_sent_at columns on profiles —
 * service-role only, guarded by the protect_entitlements() trigger):
 *
 *   1. REMINDER — Pro ending within REMINDER_DAYS_BEFORE days.
 *      Auto-renew subscribers are EXCLUDED: their card renews automatically,
 *      so an "expiring" email would be wrong. Cancelled / one-time / manual
 *      users are included.
 *
 *   2. TERMINATION — Pro lapsed within the last EXPIRED_LOOKBACK_HOURS.
 *      Only fires on a TRUE lapse: auto-renewed users get pro_expires_at
 *      extended by the renewal webhook, so they never match. An auto-renewal
 *      still "in flight" (subscription active, date just passed) is also
 *      excluded so a successful late renewal never gets a scary email.
 *      Failed renewals (past_due) ARE included — they genuinely lapsed.
 *
 * DELIVERY SEMANTICS: an email is marked as sent ONLY after ZeptoMail
 * confirms success. A failed send retries on the next daily run.
 */

/** How many days before expiry the reminder email fires. */
export const REMINDER_DAYS_BEFORE = 3;

/** Termination emails only go to users who expired within this window. */
const EXPIRED_LOOKBACK_MS = 48 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProExpiryRunSummary {
  ranAt: string;
  remindersSent: number;
  expirationsSent: number;
  failures: string[];
}

export async function runProExpiryNotifications(): Promise<ProExpiryRunSummary> {
  const summary: ProExpiryRunSummary = {
    ranAt: new Date().toISOString(),
    remindersSent: 0,
    expirationsSent: 0,
    failures: [],
  };

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const now = Date.now();

  // Users with an ACTIVE Flutterwave auto-renewal: their card will be
  // re-charged (or was just re-charged) — no expiry emails for them.
  const { data: autoRenewRows, error: autoRenewError } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("provider", "flutterwave")
    .eq("status", "active")
    .eq("cancel_at_period_end", false);

  if (autoRenewError) {
    summary.failures.push(`auto-renew lookup: ${autoRenewError.message}`);
    return summary; // cannot safely target users — abort this run
  }
  const autoRenewIds = (autoRenewRows ?? []).map((r) => r.user_id);

  // NOTE: supabase-js query-builder types explode ("excessively deep") when a
  // builder is conditionally reassigned, so the exclusion is applied INLINE on
  // every chain. When the list is empty a sentinel UUID is used — it matches
  // no real user id, so the filter is a no-op.
  const EXCLUDE_SENTINEL = "00000000-0000-0000-0000-000000000000";
  const excludedIds =
    autoRenewIds.length > 0
      ? `(${autoRenewIds.join(",")})`
      : `(${EXCLUDE_SENTINEL})`;

  // ── 1. Reminders — Pro ending within the next REMINDER_DAYS_BEFORE days ──
  const { data: dueReminders, error: reminderError } = await admin
    .from("profiles")
    .select("id, username, email, pro_expires_at")
    .eq("plan", "pro")
    .eq("is_exempt", false)
    .not("pro_expires_at", "is", null)
    .not("email", "is", null)
    .gt("pro_expires_at", new Date(now).toISOString())
    .lte(
      "pro_expires_at",
      new Date(now + REMINDER_DAYS_BEFORE * DAY_MS).toISOString()
    )
    .is("pro_reminder_sent_at", null)
    .not("id", "in", excludedIds);

  if (reminderError) {
    summary.failures.push(`reminder query: ${reminderError.message}`);
  } else {
    for (const row of dueReminders ?? []) {
      const expiresAt = row.pro_expires_at as string;
      const daysLeft = Math.max(
        1,
        Math.ceil((new Date(expiresAt).getTime() - now) / DAY_MS)
      );

      const result = await sendProExpiryReminderEmail({
        email: row.email as string,
        username: (row.username as string) || "there",
        proExpiresAt: expiresAt,
        daysLeft,
      });

      if (result.success) {
        await admin
          .from("profiles")
          .update({ pro_reminder_sent_at: new Date().toISOString() })
          .eq("id", row.id);
        summary.remindersSent++;
      } else {
        summary.failures.push(
          `reminder → ${(row.email as string)}: ${result.error}`
        );
      }
    }
  }

  // ── 2. Terminations — Pro lapsed within the lookback window ──
  const { data: expiredRows, error: expiredError } = await admin
    .from("profiles")
    .select("id, username, email, pro_expires_at")
    .eq("plan", "pro")
    .eq("is_exempt", false)
    .not("pro_expires_at", "is", null)
    .not("email", "is", null)
    .lt("pro_expires_at", new Date(now).toISOString())
    .gt("pro_expires_at", new Date(now - EXPIRED_LOOKBACK_MS).toISOString())
    .is("pro_expiry_notice_sent_at", null)
    .not("id", "in", excludedIds);

  if (expiredError) {
    summary.failures.push(`expiry query: ${expiredError.message}`);
  } else {
    for (const row of expiredRows ?? []) {
      const expiresAt = row.pro_expires_at as string;

      const result = await sendProExpiredEmail({
        email: row.email as string,
        username: (row.username as string) || "there",
        proExpiresAt: expiresAt,
      });

      if (result.success) {
        await admin
          .from("profiles")
          .update({ pro_expiry_notice_sent_at: new Date().toISOString() })
          .eq("id", row.id);
        summary.expirationsSent++;
      } else {
        summary.failures.push(
          `expiry → ${(row.email as string)}: ${result.error}`
        );
      }
    }
  }

  return summary;
}