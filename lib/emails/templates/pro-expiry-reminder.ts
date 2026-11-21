import { BRAND_COLORS, getLogoUrl, getSiteUrl } from "../config";

/**
 * Pro expiry reminder — "Your Pro ends in N days".
 *
 * Sent by the daily cron job to subscribers whose pro_expires_at is within
 * the reminder window (auto-renew subscribers are filtered out upstream).
 * Same conventions as referral-reward.ts: pure function, inline CSS (email
 * clients strip <style>), all values HTML-escaped.
 */

export interface ProExpiryReminderEmailData {
  username: string;
  /** ISO timestamp of when Pro expires. */
  proExpiresAt: string;
  /** Days remaining (informational — always ≥ 1). */
  daysLeft: number;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

export function renderProExpiryReminder(
  data: ProExpiryReminderEmailData
): string {
  const name = escapeHtml(data.username || "there");
  const days = Math.max(1, Number(data.daysLeft) || 1);
  const expiry = escapeHtml(
    new Date(data.proExpiresAt).toLocaleDateString("en-NG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  );
  const logoUrl = getLogoUrl();
  const renewUrl = `${getSiteUrl()}/${encodeURIComponent(data.username)}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Pro ends soon</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND_COLORS.black};padding:32px 40px;text-align:center;">
              <img src="${logoUrl}" alt="Konneqta" width="48" height="48" style="margin-bottom:12px;border-radius:8px;" />
              <h1 style="color:${BRAND_COLORS.white};font-size:24px;font-weight:700;margin:0;letter-spacing:-0.5px;">Your Pro ends in ${days} day${days === 1 ? "" : "s"}</h1>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:linear-gradient(to right, ${BRAND_COLORS.purple}, ${BRAND_COLORS.orange});font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 16px 40px;text-align:center;">
              <div style="display:inline-block;width:56px;height:56px;background-color:#fff7ed;border-radius:50%;line-height:56px;font-size:28px;margin-bottom:12px;">&#9203;</div>
              <p style="color:${BRAND_COLORS.grayDark};font-size:16px;margin:0;">
                Hi ${name} — your <strong>Konneqta Pro</strong> subscription is set to end soon. Renew now to keep your premium features without interruption.
              </p>
            </td>
          </tr>

          <!-- Expiry box -->
          <tr>
            <td style="padding:16px 40px 12px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:20px;">
                <tr>
                  <td style="color:${BRAND_COLORS.grayMid};font-size:14px;width:50%;">Your Pro ends on</td>
                  <td style="color:${BRAND_COLORS.orange};font-size:15px;font-weight:700;text-align:right;width:50%;">${expiry}</td>
                </tr>
                <tr>
                  <td style="padding-top:8px;color:${BRAND_COLORS.grayMid};font-size:14px;">Days remaining</td>
                  <td style="padding-top:8px;color:${BRAND_COLORS.black};font-size:14px;font-weight:600;text-align:right;">${days}</td>
                </tr>
              </table>
              <p style="color:${BRAND_COLORS.grayMid};font-size:13px;margin:16px 0 0 0;line-height:1.6;">
                After that you return to the free plan: 
                <ul style="color:${BRAND_COLORS.grayDark};font-size:14px;margin:0;padding-left:20px;line-height:1.8;">
                <li>3 links instead of 7 ❌</li>
                <li>2 Showcase Items 🗙</li>
                <li>10 Konneqts 🗙</li>
                <li>No Profile Analytics ❌</li>
                <li>1 profile card instead of 3 🗙</li>
                <li>No Card modifications ❌</li>
                <li>No background image upload ❌</li>
                <li>No Company/brand logo ❌</li>
                </ul>
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:8px 40px 32px 40px;text-align:center;">
              <a href="${renewUrl}" style="display:inline-block;background-color:${BRAND_COLORS.orange};color:#ffffff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;">Renew Now</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px 40px;border-top:1px solid ${BRAND_COLORS.grayBorder};text-align:center;">
              <p style="color:${BRAND_COLORS.grayMid};font-size:12px;margin:0;line-height:1.6;">
                This is an automated expiry reminder from Konneqta.<br>
                Questions? Contact us at info@konneqta.com
              </p>
              <p style="color:${BRAND_COLORS.grayBorder};font-size:11px;margin:10px 0 0 0;">
                &#169; ${new Date().getFullYear()} Konneqta. All rights reserved.
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