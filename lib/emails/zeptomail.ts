import { getSender, type EmailSenderType } from "./config";

/**
 * ZeptoMail transactional email service.
 *
 * SECURITY NOTES
 * --------------
 * - The ZEPTOMAIL_API_KEY is SERVER-SIDE ONLY (no NEXT_PUBLIC_ prefix). It is
 *   never exposed to the browser.
 * - All functions are called exclusively from server-side routes (webhook,
 *   verify) — never from client components.
 * - Email failures are caught and logged — they never break the payment flow.
 *   A user's Pro access is never dependent on whether the email sent.
 * - The "from" address must be a VERIFIED sender in ZeptoMail. If the domain
 *   isn't verified, ZeptoMail rejects the request and we log it.
 * - Each email type sends from a dedicated address (receipts@, info@,
 *   security@, admin@) so the user always knows who they're hearing from.
 *
 * API docs: https://www.zoho.com/zeptomail/help/api/email-sending.html
 */

const ZEPTOMAIL_API_URL = "https://api.zeptomail.com/v1.1/email";

/** Shared shape for the data both email templates need. */
export interface PaymentEmailData {
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: string;
  planName: string;
  txRef: string;
  transactionId: number | string;
  paymentDate: string;
}

/**
 * Core send function — calls the ZeptoMail REST API.
 * Takes a sender type so each email type uses the correct "from" address.
 *
 * @param senderType Which sender to use: "receipts" | "info" | "security" | "admin"
 */
async function sendEmail(
  senderType: EmailSenderType,
  toEmail: string,
  toName: string,
  subject: string,
  htmlBody: string
): Promise<{ success: boolean; error?: string }> {
  // The API key from ZeptoMail includes its own prefix (e.g.
  // "Zoho-enczapikey ..."). Use it as-is in the Authorization header.
  const apiKey = process.env.ZEPTOMAIL_API_KEY;

  // If no API key is configured, fail gracefully — the payment still succeeds.
  if (!apiKey) {
    console.warn(
      "[zeptomail] ZEPTOMAIL_API_KEY not set — skipping email send to:",
      toEmail
    );
    return { success: false, error: "API key not configured" };
  }

  // Basic email format validation before making the API call.
  if (!toEmail || !toEmail.includes("@")) {
    console.warn("[zeptomail] Invalid recipient email, skipping:", toEmail);
    return { success: false, error: "Invalid recipient email" };
  }

  try {
    const response = await fetch(ZEPTOMAIL_API_URL, {
      method: "POST",
      headers: {
        // The key already includes its prefix (e.g. "Zoho-enczapikey ..."),
        // so we use it directly.
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        from: getSender(senderType),
        to: [
          {
            email_address: {
              address: toEmail,
              name: toName,
            },
          },
        ],
        subject,
        htmlbody: htmlBody,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        `[zeptomail] API error (${response.status}) sending to ${toEmail}:`,
        JSON.stringify(data)
      );
      return {
        success: false,
        error: data?.error?.message || `HTTP ${response.status}`,
      };
    }

    return { success: true };
  } catch (err) {
    console.error(`[zeptomail] Network error sending to ${toEmail}:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Send a payment receipt to the user who just paid.
 * Sends from receipts@konneqta.com.
 */
export async function sendPaymentReceipt(
  data: PaymentEmailData
): Promise<{ success: boolean; error?: string }> {
  const { renderPaymentReceipt } = await import(
    "./templates/payment-receipt"
  );

  const html = renderPaymentReceipt(data);

  return sendEmail(
    "receipts",
    data.customerEmail,
    data.customerName,
    `Payment Receipt — ${data.planName}`,
    html
  );
}

/**
 * Send an admin notification that a payment was received.
 * Sends from admin@konneqta.com to ADMIN_NOTIFICATION_EMAIL.
 */
export async function sendAdminNotification(
  data: PaymentEmailData
): Promise<{ success: boolean; error?: string }> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;

  if (!adminEmail) {
    console.warn(
      "[zeptomail] ADMIN_NOTIFICATION_EMAIL not set — skipping admin email."
    );
    return { success: false, error: "Admin email not configured" };
  }

  const { renderAdminNotification } = await import(
    "./templates/admin-notification"
  );

  const html = renderAdminNotification(data);

  return sendEmail(
    "admin",
    adminEmail,
    "Konneqta Admin",
    `New Payment — ${data.customerName} (${data.planName})`,
    html
  );
}

/**
 * Send a password-reset OTP to a user.
 * Sends from security@konneqta.com. The 6-digit code is rendered large and
 * centered in the email body (Stripe/GitHub style).
 */
export async function sendPasswordResetOtp(
  toEmail: string,
  toName: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  const { renderPasswordResetOtp } = await import(
    "./templates/password-reset-otp"
  );

  const html = renderPasswordResetOtp({ email: toEmail, otp });

  return sendEmail(
    "security",
    toEmail,
    toName || "there",
    "Your Konneqta password reset code",
    html
  );
}
