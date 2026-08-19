import { BRAND_COLORS, getLogoUrl } from "../config";

import type { ContactEmailData } from "./contact-confirmation";

/**
 * Contact-form admin alert (sent to info@konneqta.com / ADMIN_NOTIFICATION_EMAIL).
 *
 * Compact "new message" digest for the team: who, contact details, the full
 * message, and when. Styled like the payment admin notification.
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

export function renderContactAdminAlert(data: ContactEmailData): string {
  const name = escapeHtml(data.name || "Unknown");
  const email = escapeHtml(data.email);
  const message = escapeHtml(data.message);
  const date = escapeHtml(data.date);
  const logoUrl = getLogoUrl();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Contact Message</title>
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
              <h1 style="color:${BRAND_COLORS.white};font-size:18px;font-weight:700;margin:0;">New Contact Message</h1>
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
                A new message arrived via the contact form:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:20px;border:1px solid ${BRAND_COLORS.grayBorder};">
                <tr>
                  <td style="padding:8px 0;color:${BRAND_COLORS.grayMid};font-size:14px;width:40%;">From</td>
                  <td style="padding:8px 0;color:${BRAND_COLORS.black};font-size:14px;font-weight:600;text-align:right;width:60%;">${name}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:${BRAND_COLORS.grayMid};font-size:14px;">Email</td>
                  <td style="padding:8px 0;color:${BRAND_COLORS.black};font-size:14px;font-weight:600;text-align:right;">${email}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:${BRAND_COLORS.grayMid};font-size:14px;">Date</td>
                  <td style="padding:8px 0;color:${BRAND_COLORS.black};font-size:14px;font-weight:600;text-align:right;">${date}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:16px 0 0 0;border-top:1px solid ${BRAND_COLORS.grayBorder};"></td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:12px 0 0 0;color:${BRAND_COLORS.grayMid};font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Message</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:8px 0 0 0;color:${BRAND_COLORS.grayDark};font-size:14px;line-height:1.6;">${message}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Quick reply CTA -->
          <tr>
            <td style="padding:0 40px 8px 40px;text-align:center;">
              <a href="mailto:${email}"
                 style="display:inline-block;background:${BRAND_COLORS.orange};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;">
                Reply by email
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 40px 28px 40px;border-top:1px solid ${BRAND_COLORS.grayBorder};text-align:center;">
              <p style="color:${BRAND_COLORS.grayMid};font-size:12px;margin:0;">
                This is an automated notification from the Konneqta contact system. Also logged in Google Sheets.
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