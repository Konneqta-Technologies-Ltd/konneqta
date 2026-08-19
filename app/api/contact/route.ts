import { NextRequest, NextResponse } from 'next/server';

import { sendContactEmails } from "@/lib/emails/zeptomail";

/**
 * POST /api/contact — contact form submission.
 *
 * Flow:
 *   1. Validate the payload server-side (required fields, email format,
 *      length caps). The form validates client-side too, but the API is
 *      public — anything can POST raw.
 *   2. Append the row to Google Sheets via the Apps Script Web App
 *      (unchanged — remains the archive of record).
 *   3. Send emails (best-effort, non-fatal):
 *      - Confirmation to the sender ("We got your message")
 *      - Alert to the admin inbox (ADMIN_NOTIFICATION_EMAIL, default
 *        info@konneqta.com)
 *
 * SECURITY
 *   GOOGLE_SCRIPT_URL and the ZeptoMail key are server-side only. Email
 *   failures are logged and swallowed — a mail hiccup never fails the
 *   user's submission.
 */

// Caps mirrored from the contact form's expectations. Generous but finite —
// prevents someone using the API as a free bulk-mail relay via the
// confirmation email.
const MAX_NAME = 100;
const MAX_MESSAGE = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, message: 'Invalid request body.' },
        { status: 400 },
      );
    }

    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim();
    const message = String(body.message ?? '').trim();

    // --- Validation --------------------------------------------------------
    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, message: 'Name, email and message are required.' },
        { status: 400 },
      );
    }
    if (name.length > MAX_NAME) {
      return NextResponse.json(
        { success: false, message: 'Name is too long.' },
        { status: 400 },
      );
    }
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid email address.' },
        { status: 400 },
      );
    }
    if (message.length > MAX_MESSAGE) {
      return NextResponse.json(
        { success: false, message: 'Message is too long (max 2000 characters).' },
        { status: 400 },
      );
    }

    const date = new Date().toISOString();

    // --- Google Sheets (unchanged behavior) ---------------------------------
    const response = await fetch(process.env.GOOGLE_SCRIPT_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, message, date, sheet: 'Contact' }),
    });

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(data, {
        status: data.duplicate ? 409 : 400,
      });
    }

    // --- Emails (best-effort — never fail the submission) -------------------
    // sendContactEmails logs its own failures internally.
    await sendContactEmails({ name, email, message, date });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[api/contact] error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Unable to send your message.',
      },
      {
        status: 500,
      },
    );
  }
}