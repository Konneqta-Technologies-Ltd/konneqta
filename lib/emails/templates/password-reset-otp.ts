import { BRAND_COLORS, getLogoUrl } from "../config";

/**
 * Password reset OTP email template.
 *
 * The 6-digit code is rendered LARGE and CENTERED (Stripe / GitHub / Notion
 * style) so the user can read it at a glance — no paragraphs to scan.
 *
 * BRANDING
 * --------
 * Uses the same branded header (black + gradient strip) and footer as the
 * payment receipt template for visual consistency.
 *
 * SECURITY
 * --------
 * Pure function — takes data, returns an HTML string. The OTP is HTML-escaped.
 * Inline CSS because email clients strip <style> tags.
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

export interface PasswordResetOtpData {
  email: string;
  otp: string;
}

export function renderPasswordResetOtp(data: PasswordResetOtpData): string {
  const email = escapeHtml(data.email);
  const otp = escapeHtml(data.otp);
  // Format as "123 456" for readability while keeping digits intact.
  const otpSpaced = `${otp.slice(0, 3)} ${otp.slice(3)}`;
  const logoUrl = getLogoUrl();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Konneqta password reset code</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header: Black with logo + gradient accent strip -->
          <tr>
            <td style="background-color:${BRAND_COLORS.black};padding:32px 40px;text-align:center;">
              <img src="${logoUrl}" alt="Konneqta" width="48" height="48" style="margin-bottom:12px;border-radius:8px;" />
              <h1 style="color:${BRAND_COLORS.white};font-size:22px;font-weight:700;margin:0;letter-spacing:-0.5px;">Password reset</h1>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:linear-gradient(to right, ${BRAND_COLORS.purple}, ${BRAND_COLORS.orange});font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding:32px 40px 8px 40px;text-align:center;">
              <p style="color:${BRAND_COLORS.grayDark};font-size:15px;margin:0;line-height:1.6;">
                Use the code below to reset your Konneqta password.<br>
                This code expires in <strong>10 minutes</strong>.
              </p>
            </td>
          </tr>

          <!-- BIG CENTERED OTP -->
          <tr>
            <td style="padding:24px 40px 8px 40px;text-align:center;">
              <div style="display:inline-block;background-color:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:24px 40px;margin:8px 0;">
                <span style="font-size:42px;font-weight:800;letter-spacing:8px;color:${BRAND_COLORS.purpleDark};font-family:'SF Mono',SFMono-Regular,ui-monospace,'Cascadia Code',Menlo,Consolas,monospace;">${otpSpaced}</span>
              </div>
            </td>
          </tr>

          <!-- Helper note -->
          <tr>
            <td style="padding:8px 40px 32px 40px;text-align:center;">
              <p style="color:${BRAND_COLORS.grayMid};font-size:13px;margin:0;line-height:1.6;">
                Enter this code on the verification page to continue.<br>
                If you didn't request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px 40px;border-top:1px solid ${BRAND_COLORS.grayBorder};text-align:center;">
              <p style="color:${BRAND_COLORS.grayMid};font-size:12px;margin:0;line-height:1.6;">
                This is an automated security email for ${email}.<br>
                Never share this code with anyone. Konneqta will never ask for it.
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