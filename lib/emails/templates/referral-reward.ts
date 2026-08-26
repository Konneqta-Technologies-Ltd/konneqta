import { BRAND_COLORS, getLogoUrl } from "../config";

/**
 * Referral reward email — sent to the REFERRER when a referred user's first
 * subscription payment converts ("N Premium days have been added").
 *
 * Same conventions as payment-receipt.ts: pure function, inline CSS (email
 * clients strip <style>), all values HTML-escaped.
 */

export interface ReferralRewardEmailData {
  referrerName: string;
  daysAdded: number;
  /** Referred user's username (public info — no email/name shared). */
  referredUsername: string | null;
  /** ISO timestamp of the referrer's new Premium expiry. */
  newProExpiresAt: string;
}

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

export function renderReferralReward(data: ReferralRewardEmailData): string {
  const name = escapeHtml(data.referrerName || "there");
  const days = Number(data.daysAdded) || 0;
  const referred = data.referredUsername
    ? escapeHtml(`@${data.referredUsername}`)
    : "someone you referred";
  const newExpiry = escapeHtml(
    new Date(data.newProExpiresAt).toLocaleDateString("en-NG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  );
  const logoUrl = getLogoUrl();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Referral Reward</title>
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
              <h1 style="color:${BRAND_COLORS.white};font-size:24px;font-weight:700;margin:0;letter-spacing:-0.5px;">You earned Premium days!</h1>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:linear-gradient(to right, ${BRAND_COLORS.purple}, ${BRAND_COLORS.orange});font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 16px 40px;text-align:center;">
              <div style="display:inline-block;width:56px;height:56px;background-color:#ffedd5;border-radius:50%;line-height:56px;font-size:28px;margin-bottom:12px;">&#127881;</div>
              <p style="color:${BRAND_COLORS.grayDark};font-size:16px;margin:0;">
                Great news, ${name} — <strong>${referred}</strong> just subscribed to Konneqta Premium with your referral code.
              </p>
            </td>
          </tr>

          <!-- Reward box -->
          <tr>
            <td style="padding:16px 40px 28px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:20px;">
                <tr>
                  <td style="color:${BRAND_COLORS.grayMid};font-size:14px;width:50%;">Premium days added</td>
                  <td style="color:${BRAND_COLORS.orange};font-size:24px;font-weight:700;text-align:right;width:50%;">+${days} days</td>
                </tr>
                <tr>
                  <td style="padding-top:8px;color:${BRAND_COLORS.grayMid};font-size:14px;">Premium now active until</td>
                  <td style="padding-top:8px;color:${BRAND_COLORS.black};font-size:14px;font-weight:600;text-align:right;">${newExpiry}</td>
                </tr>
              </table>
              <p style="color:${BRAND_COLORS.grayMid};font-size:13px;margin:16px 0 0 0;line-height:1.6;">
                Keep sharing your referral code — every friend who subscribes adds more free Premium days to your account.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px 40px;border-top:1px solid ${BRAND_COLORS.grayBorder};text-align:center;">
              <p style="color:${BRAND_COLORS.grayMid};font-size:12px;margin:0;line-height:1.6;">
                This is an automated referral notification from Konneqta.<br>
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
