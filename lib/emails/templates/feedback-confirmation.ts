import { BRAND_COLORS, getLogoUrl } from "../config";

/**
 * Feedback confirmation email (sent to the user who submitted feedback).
 *
 * Thanks the user and gives them their searchable reference ID
 * (e.g. FB-20260819-A1B2) so they can quote it in follow-ups.
 *
 * SECURITY
 * --------
 * Pure function — takes data, returns an HTML string. No side effects.
 * All values are HTML-escaped.
 */

export type FeedbackEmailData = {
  feedbackId: string;
  email: string;
  sentiment: "positive" | "neutral" | "negative";
  comment: string;
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

export function renderFeedbackConfirmation(data: FeedbackEmailData): string {
  const feedbackId = escapeHtml(data.feedbackId);
  const comment = escapeHtml(data.comment);
  const date = escapeHtml(data.date);
  const logoUrl = getLogoUrl();

  // Sentiment-appropriate thank-you line.
  const thankYou =
    data.sentiment === "positive"
      ? "Wonderful — thank you for the kind words! Feedback like this keeps us building."
      : data.sentiment === "negative"
        ? "Thank you for telling us what went wrong — we take it seriously and will look into it."
        : "Thank you for sharing your thoughts — every piece of feedback helps us improve.";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thanks for your feedback</title>
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
              <h1 style="color:${BRAND_COLORS.white};font-size:18px;font-weight:700;margin:0;">Thanks for your feedback!</h1>
            </td>
          </tr>
          <!-- Orange accent strip -->
          <tr>
            <td style="height:4px;background:${BRAND_COLORS.orange};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 40px 12px 40px;">
              <p style="color:${BRAND_COLORS.grayDark};font-size:15px;margin:0 0 20px 0;">
                ${thankYou}
              </p>
              ${comment ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:20px;border:1px solid ${BRAND_COLORS.grayBorder};">
                <tr>
                  <td style="padding:4px 0;color:${BRAND_COLORS.grayMid};font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">What you told us</td>
                </tr>
                <tr>
                  <td style="padding:8px 0 0 0;color:${BRAND_COLORS.grayDark};font-size:14px;line-height:1.6;">${comment}</td>
                </tr>
                <tr>
                  <td style="padding:16px 0 0 0;color:${BRAND_COLORS.grayMid};font-size:12px;">Sent ${date}</td>
                </tr>
              </table>
              ` : ""}
              <p style="color:${BRAND_COLORS.grayDark};font-size:14px;margin:20px 0 0 0;">
                Your reference: <strong style="font-family:monospace;color:${BRAND_COLORS.purple};">${feedbackId}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 40px 28px 40px;border-top:1px solid ${BRAND_COLORS.grayBorder};text-align:center;">
              <p style="color:${BRAND_COLORS.grayMid};font-size:12px;margin:0;">
                Keep the reference above handy if you contact us about this feedback.
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