import { BRAND_COLORS, getLogoUrl, getSiteUrl } from "../config";

/**
 * Pro expired / termination notice — "Your Konneqta Pro has expired".
 *
 * Sent by the daily cron job when a subscriber's pro_expires_at has just
 * passed WITHOUT a renewal (auto-renewed users never match — their date is
 * extended by the renewal webhook). Same conventions as referral-reward.ts:
 * pure function, inline CSS, all values HTML-escaped.
 */

export interface ProExpiredEmailData {
  username: string;
  /** ISO timestamp of when Pro actually lapsed. */
  proExpiresAt: string;
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

export function renderProExpired(data: ProExpiredEmailData): string {
  const name = escapeHtml(data.username || "there");
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
  <title>Your Pro has expired</title>
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
              <h1 style="color:${BRAND_COLORS.white};font-size:24px;font-weight:700;margin:0;letter-spacing:-0.5px;">Your Konneqta Pro has expired</h1>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:linear-gradient(to right, ${BRAND_COLORS.grayMid}, ${BRAND_COLORS.black});font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 16px 40px;text-align:center;">
              <div style="display:inline-block;width:56px;height:56px;background-color:#f4f4f5;border-radius:50%;line-height:56px;font-size:28px;margin-bottom:12px;">&#128078;</div>
              <p style="color:${BRAND_COLORS.grayDark};font-size:16px;margin:0;">
                Hi ${name} — your <strong>Konneqta Pro</strong> subscription ended on <strong>${expiry}</strong>, and your account has moved back to the free plan.
              </p>
            </td>
          </tr>

          <!-- What changed box -->
          <tr>
            <td style="padding:16px 40px 12px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND_COLORS.grayLight};border:1px solid ${BRAND_COLORS.grayBorder};border-radius:8px;padding:20px;">
                <tr>
                  <td style="color:${BRAND_COLORS.grayMid};font-size:14px;padding-bottom:8px;">&#128196; &nbsp;Links limit: <strong style="color:${BRAND_COLORS.black};">3 Links</strong> (Pro had 7)</td>
                </tr>
                <tr>
                  <td style="color:${BRAND_COLORS.grayMid};font-size:14px;padding-bottom:8px;">&#127912; &nbsp;Themes: <strong style="color:${BRAND_COLORS.black};">standard only</strong></td>
                </tr>
                <tr>
                  <td style="color:${BRAND_COLORS.grayMid};font-size:14px;">&#11088; &nbsp;Premium perks: <strong style="color:${BRAND_COLORS.black};">locked</strong></td>
                </tr>
              </table>
              <p style="color:${BRAND_COLORS.grayMid};font-size:13px;margin:16px 0 0 0;line-height:1.6;">
                Your existing cards and data are safe — nothing was deleted. Resubscribe anytime to unlock Pro again.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:8px 40px 32px 40px;text-align:center;">
              <a href="${renewUrl}" style="display:inline-block;background-color:${BRAND_COLORS.purple};color:#ffffff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;">Get Pro Again</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px 40px;border-top:1px solid ${BRAND_COLORS.grayBorder};text-align:center;">
              <p style="color:${BRAND_COLORS.grayMid};font-size:12px;margin:0;line-height:1.6;">
                This is an automated notification from Konneqta.<br>
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