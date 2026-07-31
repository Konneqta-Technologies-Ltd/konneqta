import { BRAND_COLORS, getLogoUrl } from "../config";

import type { PaymentEmailData } from "../zeptomail";

/**
 * Payment receipt email template (sent to the user).
 *
 * BRANDING
 * --------
 * Uses Konneqta brand colors:
 *   - Header: Black background with white logo (k-white.png)
 *   - Accents: Purple (#7751b8) and Orange (#FF6B2C)
 *   - Body: White/light gray
 *
 * SECURITY
 * --------
 * Pure function — takes data, returns an HTML string. No side effects.
 * Inline CSS is used because email clients strip <style> tags.
 * All values are HTML-escaped to prevent injection.
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

function formatAmount(amount: number, currency: string): string {
  // Flutterwave returns NGN amounts in whole naira (e.g. 950 = ₦950),
  // NOT in kobo/cents. Do NOT divide by 100.
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function renderPaymentReceipt(data: PaymentEmailData): string {
  const name = escapeHtml(data.customerName || "there");
  const amount = formatAmount(data.amount, data.currency);
  const planName = escapeHtml(data.planName);
  const txRef = escapeHtml(data.txRef);
  const transactionId = escapeHtml(String(data.transactionId));
  const date = escapeHtml(data.paymentDate);
  const logoUrl = getLogoUrl();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header: Black with logo + purple/orange accent strip -->
          <tr>
            <td style="background-color:${BRAND_COLORS.black};padding:32px 40px;text-align:center;">
              <img src="${logoUrl}" alt="Konneqta" width="48" height="48" style="margin-bottom:12px;border-radius:8px;" />
              <h1 style="color:${BRAND_COLORS.white};font-size:24px;font-weight:700;margin:0;letter-spacing:-0.5px;">Payment Successful</h1>
            </td>
          </tr>
          <!-- Purple-to-Orange accent strip -->
          <tr>
            <td style="height:4px;background:linear-gradient(to right, ${BRAND_COLORS.purple}, ${BRAND_COLORS.orange});font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Success Badge -->
          <tr>
            <td style="padding:32px 40px 16px 40px;text-align:center;">
              <div style="display:inline-block;width:56px;height:56px;background-color:#dcfce7;border-radius:50%;line-height:56px;font-size:28px;margin-bottom:12px;">&#10003;</div>
              <p style="color:${BRAND_COLORS.grayDark};font-size:16px;margin:0;">Thank you for your purchase, ${name}!</p>
            </td>
          </tr>

          <!-- Receipt Details -->
          <tr>
            <td style="padding:16px 40px 28px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:20px;border:1px solid ${BRAND_COLORS.grayBorder};">
                <tr>
                  <td style="padding:8px 0;color:${BRAND_COLORS.grayMid};font-size:14px;width:50%;">Plan</td>
                  <td style="padding:8px 0;color:${BRAND_COLORS.black};font-size:14px;font-weight:600;text-align:right;width:50%;">${planName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:${BRAND_COLORS.grayMid};font-size:14px;">Amount</td>
                  <td style="padding:8px 0;color:${BRAND_COLORS.orange};font-size:18px;font-weight:700;text-align:right;">${amount}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:${BRAND_COLORS.grayMid};font-size:14px;">Transaction ID</td>
                  <td style="padding:8px 0;color:${BRAND_COLORS.black};font-size:14px;font-weight:600;text-align:right;">${transactionId}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:${BRAND_COLORS.grayMid};font-size:14px;">Reference</td>
                  <td style="padding:8px 0;color:${BRAND_COLORS.black};font-size:14px;font-weight:600;text-align:right;font-family:monospace;">${txRef}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:${BRAND_COLORS.grayMid};font-size:14px;">Date</td>
                  <td style="padding:8px 0;color:${BRAND_COLORS.black};font-size:14px;font-weight:600;text-align:right;">${date}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Features Unlocked -->
          <tr>
            <td style="padding:0 40px 28px 40px;">
              <div style="background-color:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:20px;">
                <p style="color:${BRAND_COLORS.purpleDark};font-size:14px;font-weight:600;margin:0 0 8px 0;">&#127881; What you unlocked:</p>
                <ul style="color:${BRAND_COLORS.grayDark};font-size:14px;margin:0;padding-left:20px;line-height:1.8;">
                  <li>Up to 3 profile cards</li>
                  <li>Custom themes and colors</li>
                  <li>Banner image upload</li>
                  <li>Email signature builder</li>
                  <li>Company/brand logo</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px 40px;border-top:1px solid ${BRAND_COLORS.grayBorder};text-align:center;">
              <p style="color:${BRAND_COLORS.grayMid};font-size:12px;margin:0;line-height:1.6;">
                This is an automated receipt for your Konneqta subscription.<br>
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