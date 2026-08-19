import type { FeedbackPayload } from "@/lib/feedback/google-sheets";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { renderContactAdminAlert } from "@/lib/emails/templates/contact-admin-alert";
import { renderContactConfirmation } from "@/lib/emails/templates/contact-confirmation";
import { renderFeedbackAdminAlert } from "@/lib/emails/templates/feedback-admin-alert";
import { renderFeedbackConfirmation } from "@/lib/emails/templates/feedback-confirmation";

/**
 * DEV-ONLY email template preview — /dev/emails
 *
 * Renders every transactional email template with realistic sample data in
 * full-width iframes, so you can tweak the templates and instantly see the
 * result on localhost without sending real emails or touching ZeptoMail.
 *
 * SECURITY
 * --------
 * 404s unless NODE_ENV === "development". This page must NEVER render in
 * production (it exposes nothing sensitive, but there's no reason to ship a
 * template gallery). The check runs at request time, not build time, so the
 * route is safe even if a production build somehow includes the file.
 */

export const metadata: Metadata = {
  title: "Email Templates · Konneqta (dev)",
  robots: { index: false, follow: false },
};

// ---------------------------------------------------------------------------
// Sample data — deliberately realistic (long names, mixed casing, punctuation)
// so escaping and wrapping are exercised.
// ---------------------------------------------------------------------------
const contactData = {
  name: "Adaeze Okafor-Johnson",
  email: "adaeze.example+test@konneqta.com",
  message:
    "Hi team! I <love> the new QR scanner — it's blazing fast. " +
    "Quick question: can I add my WhatsApp Business link to my card, and " +
    "does the free plan support custom link labels? Keep up the great work!",
  date: new Date("2026-08-19T13:45:00Z").toUTCString(),
};

const feedbackData = {
  feedbackId: "FB-20260819-A1B2",
  email: "adaeze.example+test@konneqta.com",
  sentiment: "positive" as const,
  comment:
    "The vCard download is a game changer for my networking events — " +
    "clients save me in one tap & the QR scans flawlessly.",
  date: new Date("2026-08-19T13:45:00Z").toUTCString(),
};

const feedbackMetrics: FeedbackPayload = {
  feedbackId: feedbackData.feedbackId,
  timestamp: feedbackData.date,
  sentiment: "positive",
  category: "Feature request",
  context: "after_vcard_download",
  comment: feedbackData.comment,
  rating: 5,
  plan: "pro",
  engagementScore: 42,
  shares: 12,
  profileViews: 87,
  qrScans: 34,
  vcardDownloads: 21,
  featureBeingUsed: "vcard_download",
  sessionDuration: "4m 23s",
  appVersion: "1.4.0",
  browserOs: "Chrome 138 / Android 15",
  email: feedbackData.email,
};

type TemplateEntry = {
  id: string;
  title: string;
  description: string;
  html: string;
};

function getTemplates(): TemplateEntry[] {
  return [
    {
      id: "contact-confirmation",
      title: "Contact — User Confirmation",
      description: "Sent to the person who submitted the contact form.",
      html: renderContactConfirmation(contactData),
    },
    {
      id: "contact-admin-alert",
      title: "Contact — Admin Alert",
      description: `Sent to ADMIN_NOTIFICATION_EMAIL (default info@konneqta.com).`,
      html: renderContactAdminAlert(contactData),
    },
    {
      id: "feedback-confirmation",
      title: "Feedback — User Confirmation",
      description: "Sent to the logged-in user who submitted feedback.",
      html: renderFeedbackConfirmation(feedbackData),
    },
    {
      id: "feedback-admin-alert",
      title: "Feedback — Admin Alert",
      description: "Rich digest with sentiment, rating + engagement metrics.",
      html: renderFeedbackAdminAlert(feedbackData, feedbackMetrics),
    },
  ];
}

/** Renders one email inside a seamless, auto-sizing iframe. */
function EmailFrame({ entry }: { entry: TemplateEntry }) {
  return (
    <section className="mb-12">
      <header className="mb-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {entry.title}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {entry.description}
        </p>
        <p className="mt-1 font-mono text-[11px] text-zinc-400">
          lib/emails/templates/{entry.id}.ts
        </p>
      </header>
      <iframe
        title={entry.title}
        srcDoc={entry.html}
        className="h-[820px] w-full rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800"
      />
    </section>
  );
}

export default function EmailPreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10 dark:bg-black">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Email Template Preview
        </h1>
        <p className="mt-1 mb-8 text-sm text-zinc-500 dark:text-zinc-400">
          Dev-only — tweak any template in{" "}
          <code className="rounded bg-zinc-200 px-1 font-mono text-xs dark:bg-zinc-800">
            lib/emails/templates/
          </code>{" "}
          and refresh. Nothing is sent; these render locally with sample data.
        </p>
        {getTemplates().map((entry) => (
          <EmailFrame key={entry.id} entry={entry} />
        ))}
      </div>
    </main>
  );
}