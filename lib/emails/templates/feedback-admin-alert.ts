import { BRAND_COLORS, getLogoUrl } from "../config";

import type { FeedbackEmailData } from "./feedback-confirmation";
import type { FeedbackPayload } from "@/lib/feedback/google-sheets";

/**
 * Feedback admin alert (sent to info@konneqta.com / ADMIN_NOTIFICATION_EMAIL).
 *
 * Rich digest of a new feedback submission: sentiment, rating, category,
 * comment + the engagement metrics gathered by /api/feedback. Styled like
 * the payment admin notification.
 *
 * SECURITY
 * --------
 * Pure function — takes data, returns an HTML string. No side effects.
 * All values are HTML-escaped.
 */

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "\x26amp;",
    "<": "\x26lt;",
    ">": "\x26gt;",
    '"': "\x26quot;",
    "'": "\x26#39;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/** Colored pill for the sentiment value. */
function sentimentPill(sentiment: FeedbackEmailData["sentiment"]): string {
  if (sentiment === "positive") {
    return `<span style="display:inline-block;background-color:#dcfce7;color:#166534;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;text-transform:capitalize;">${sentiment}</span>`;
  }
  if (sentiment === "negative") {
    return `<span style="display:inline-block;background-color:#fee2e2;color:#991b1b;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;text-transform:capitalize;">${sentiment}</span>`;
  }
  return `<span style="display:inline-block;background-color:#e4e4e7;color:#3f3f46;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;text-transform:capitalize;">${sentiment}</span>`;
}

function row(label: string, value: string): string {
  return `
                <tr>
                  <td style="padding:8px 0;color:${BRAND_COLORS.grayMid};font-size:14px;width:40%;">${label}</td>
                  <td style="padding:8px 0;color:${BRAND_COLORS.black};font-size:14px;font-weight:600;text-align:right;width:60%;">${value}</td>
                </tr>`;
}

export function renderFeedbackAdminAlert(
  data: FeedbackEmailData,
  metrics: FeedbackPayload
): string {
  const feedbackId = escapeHtml(data.feedbackId);
  const comment = escapeHtml(data.comment);
  const date = escapeHtml(data.date);
  const logoUrl = getLogoUrl();

  const ratingStars = metrics.rating
    ? `${"★".repeat(metrics.rating)}${"☆".repeat(5 - metrics.rating)}`
    : "—";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Feedback</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:600px;width:100%;">

          <!-- Header: Purple with logo -->
          <tr>
            <td style="background-color:${BRAND_COLORS.purple};padding:24px 40px;text-align:center;">
              <img src="${logoUrl}" alt="Konneqta" width="40" height="40" style="margin-bottom:8px;border-radius:8px;" />
              <h1 style="color:${BRAND_COLORS.white};font-size:18px;font-weight:700;margin:0;">New Feedback &nbsp;${sentimentPill(data.sentiment)}</h1>
            </td>
          </tr>
          <!-- Orange accent strip -->
          <tr>
            <td style="height:4px;background:${BRAND_COLORS.orange};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Summary -->
          <tr>
            <td style="padding:28px 40px 20px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:20px;border:1px solid ${BRAND_COLORS.grayBorder};">
                ${row("Reference", `<span style="font-family:monospace;">${feedbackId}</span>`)}
                ${row("Sentiment", sentimentPill(data.sentiment))}
                ${row("Rating", `<span style="color:${BRAND_COLORS.orange};letter-spacing:2px;">${ratingStars}</span>`)}
                ${row("Category", escapeHtml(metrics.category) || "—")}
                ${row("Feature used", escapeHtml(metrics.featureBeingUsed) || "—")}
                ${row("User", escapeHtml(metrics.email) || "—")}
                ${row("Plan", escapeHtml(metrics.plan) || "—")}
                ${row("Date", date)}
              </table>
            </td>
          </tr>

          ${
            comment
              ? `
          <!-- Comment -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:20px;border:1px solid ${BRAND_COLORS.grayBorder};">
                <tr>
                  <td style="padding:4px 0;color:${BRAND_COLORS.grayMid};font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Comment</td>
                </tr>
                <tr>
                  <td style="padding:8px 0 0 0;color:${BRAND_COLORS.grayDark};font-size:14px;line-height:1.6;">${comment}</td>
                </tr>
              </table>
            </td>
          </tr>
          `
              : ""
          }

          <!-- Engagement metrics -->
          <tr>
            <td style="padding:20px 40px 8px 40px;">
              <p style="color:${BRAND_COLORS.grayMid};font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px 0;">
                Engagement at time of feedback
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${row("Shares", String(metrics.shares))}
                ${row("Profile views", String(metrics.profileViews))}
                ${row("QR scans", String(metrics.qrScans))}
                ${row("vCard downloads", String(metrics.vcardDownloads))}
                ${row("Engagement score", String(metrics.engagementScore))}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 40px 28px 40px;border-top:1px solid ${BRAND_COLORS.grayBorder};text-align:center;">
              <p style="color:${BRAND_COLORS.grayMid};font-size:12px;margin:0;">
                This is an automated notification from the Konneqta feedback system. Also logged in Google Sheets.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}