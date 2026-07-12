import { BRAND_COLORS, getLogoUrl } from "../config";

import type { PaymentEmailData } from "../zeptomail";

/**
 * Admin notification email template (sent to ADMIN_NOTIFICATION_EMAIL).
 *
 * BRANDING
 * --------
 * Uses Konneqta brand colors — purple header with white logo.
 * More compact than the user receipt (it's for you, not the customer).
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

function formatAmount(amount: number, currency: string): string {
  const displayAmount = amount / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(displayAmount);
}

export function renderAdminNotification(data: PaymentEmailData): string {
  const name = escapeHtml(data.customerName || "Unknown");
  const email = escapeHtml(data.customerEmail);
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
  <title>New Payment Notification</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header: Purple with logo -->
          <tr>
            <td style="background-color:${BRAND_COLORS.purple};padding:24px 40px;text-align:center;">
              <img src="${logoUrl}" alt="Konneqta" width="40" height="40" style="margin-bottom:8px;border-radius:8px;" />
              <h1 style="color:${BRAND_COLORS.white};font-size:18px;font-weight:700;margin:0;">New Payment Received</h1>
            </td>
          </tr>
          <!-- Orange accent strip -->
          <tr>
            <td style="height:4px;background:${BRAND_COLORS.orange};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Summary -->
          <tr>
            <td style="padding:28px 40px 20px 40px;">
              <p style="color:${BRAND_COLORS.grayDark};font-size:15px;margin:0 0 20px 0;">
                A new payment was just completed. Here are the details:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:20px;border:1px solid ${BRAND_COLORS.grayBorder};">
                <tr>
                  <td style="padding:8px 0;color:${BRAND_COLORS.grayMid};font-size:14px;width:40%;">Customer</td>
                  <td style="padding:8px 0;color:${BRAND_COLORS.black};font-size:14px;font-weight:600;text-align:right;width:60%;">${name}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:${BRAND_COLORS.grayMid};font-size:14px;">Email</td>
                  <td style="padding:8px 0;color:${BRAND_COLORS.black};font-size:14px;font-weight:600;text-align:right;">${email}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:${BRAND_COLORS.grayMid};font-size:14px;">Plan</td>
                  <td style="padding:8px 0;color:${BRAND_COLORS.black};font-size:14px;font-weight:600;text-align:right;">${planName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:${BRAND_COLORS.grayMid};font-size:14px;">Amount</td>
                  <td style="padding:8px 0;color:${BRAND_COLORS.purple};font-size:18px;font-weight:700;text-align:right;">${amount}</td>
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

          <!-- Footer -->
          <tr>
            <td style="padding:16px 40px 28px 40px;border-top:1px solid ${BRAND_COLORS.grayBorder};text-align:center;">
              <p style="color:${BRAND_COLORS.grayMid};font-size:12px;margin:0;">
                This is an automated notification from the Konneqta payment system.
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