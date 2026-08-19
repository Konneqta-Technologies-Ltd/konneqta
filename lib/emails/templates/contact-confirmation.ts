import { BRAND_COLORS, getLogoUrl } from "../config";

/**
 * Contact-form confirmation email (sent to the person who submitted).
 *
 * Reassures the sender that their message arrived and where to expect a
 * reply from (info@konneqta.com).
 *
 * SECURITY
 * --------
 * Pure function — takes data, returns an HTML string. No side effects.
 * All values are HTML-escaped.
 */

export type ContactEmailData = {
  name: string;
  email: string;
  message: string;
  date: string;
};

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

export function renderContactConfirmation(data: ContactEmailData): string {
  const name = escapeHtml(data.name || "there");
  const message = escapeHtml(data.message);
  const date = escapeHtml(data.date);
  const logoUrl = getLogoUrl();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We received your message</title>
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
              <h1 style="color:${BRAND_COLORS.white};font-size:18px;font-weight:700;margin:0;">We got your message!</h1>
            </td>
          </tr>
          <!-- Orange accent strip -->
          <tr>
            <td style="height:4px;background:${BRAND_COLORS.orange};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 40px 12px 40px;">
              <p style="color:${BRAND_COLORS.grayDark};font-size:15px;margin:0 0 12px 0;">
                Hi ${name},
              </p>
              <p style="color:${BRAND_COLORS.grayDark};font-size:15px;margin:0 0 8px 0;">
                Thanks for reaching out to Konneqta. We've received your message and
                our team will get back to you as soon as possible.
              </p>
              <p style="color:${BRAND_COLORS.grayMid};font-size:13px;margin:0 0 20px 0;">
                We're available Monday to Friday, 9am – 5pm.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:20px;border:1px solid ${BRAND_COLORS.grayBorder};">
                <tr>
                  <td style="padding:4px 0;color:${BRAND_COLORS.grayMid};font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Your message</td>
                </tr>
                <tr>
                  <td style="padding:8px 0 0 0;color:${BRAND_COLORS.grayDark};font-size:14px;line-height:1.6;">${message}</td>
                </tr>
                <tr>
                  <td style="padding:16px 0 0 0;color:${BRAND_COLORS.grayMid};font-size:12px;">Sent ${date}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Social links -->
          <tr>
            <td style="padding:20px 40px 8px 40px;text-align:center;">
              <p style="color:${BRAND_COLORS.grayMid};font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px 0;">
                Follow us
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
                <tr>
                  <td style="padding:0 8px;">
                    <a href="https://x.com/Konneqta" target="_blank" aria-label="Konneqta on X"
                       style="display:inline-block;width:36px;height:36px;border-radius:999px;background:${BRAND_COLORS.grayLight};text-decoration:none;line-height:36px;text-align:center;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="${BRAND_COLORS.black}" style="vertical-align:middle;">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </a>
                  </td>
                  <td style="padding:0 8px;">
                    <a href="https://www.facebook.com/share/1951dS2Kkb/" target="_blank" aria-label="Konneqta on Facebook"
                       style="display:inline-block;width:36px;height:36px;border-radius:999px;background:${BRAND_COLORS.grayLight};text-decoration:none;line-height:36px;text-align:center;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2" style="vertical-align:middle;">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </a>
                  </td>
                  <td style="padding:0 8px;">
                    <a href="https://instagram.com/konneqta" target="_blank" aria-label="Konneqta on Instagram"
                       style="display:inline-block;width:36px;height:36px;border-radius:999px;background:${BRAND_COLORS.grayLight};text-decoration:none;line-height:36px;text-align:center;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#E4405F" style="vertical-align:middle;">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                      </svg>
                    </a>
                  </td>
                  <td style="padding:0 8px;">
                    <a href="https://www.linkedin.com/company/konneqta/" target="_blank" aria-label="Konneqta on LinkedIn"
                       style="display:inline-block;width:36px;height:36px;border-radius:999px;background:${BRAND_COLORS.grayLight};text-decoration:none;line-height:36px;text-align:center;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#0A66C2" style="vertical-align:middle;">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/>
                      </svg>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 40px 28px 40px;border-top:1px solid ${BRAND_COLORS.grayBorder};text-align:center;">
              <p style="color:${BRAND_COLORS.grayMid};font-size:12px;margin:0;">
                Replies come from <strong>info@konneqta.com</strong> — add us to your contacts so nothing lands in spam.
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