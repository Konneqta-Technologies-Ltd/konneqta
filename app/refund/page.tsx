import DarkModeToggle from '@/components/DarkModeToggle';
import Link from 'next/link';

export const metadata = {
  title: 'Refund Policy — Konneqta',
  description:
    'How refunds, cancellations, and renewals work for Konneqta Pro subscriptions.',
  alternates: { canonical: '/refund' },
};

const SECTIONS = [
  { id: 'overview', title: 'Overview' },
  { id: 'eligible-for-refund', title: 'Eligible for a Refund' },
  { id: 'non-refundable-cases', title: 'Non-Refundable Cases' },
  { id: 'cancellation', title: 'Cancellation & Renewals' },
  { id: 'how-refunds-are-processed', title: 'How Refunds Are Processed' },
  { id: 'requesting-a-refund', title: 'Requesting a Refund' },
  { id: 'changes-to-this-refund-policy', title: 'Changes to This Refund Policy' },
  { id: 'governing-law', title: 'Governing Law' },
  { id: 'contact-us', title: 'Contact Us' },
];

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-700 dark:bg-black dark:text-zinc-300">
      <DarkModeToggle />
      {/* Header */}
      <div className="border-b border-zinc-200 px-6 py-14 sm:px-10 dark:border-zinc-800">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/"
            className="text-xs font-medium text-zinc-500 transition-colors hover:text-(--main-orange)"
          >
            ← Back to Konneqta
          </Link>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Refund Policy
          </h1>
          <p className="mt-3 text-sm text-zinc-500">
            Last Updated: July 28, 2026
          </p>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Konneqta is a subscription-based service. This Refund Policy
            explains when charges for Konneqta Pro may be refunded, how
            cancellations work, and what to expect when a refund is approved.
            By subscribing to Konneqta Pro, you agree to the terms in this
            Refund Policy.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 px-6 py-14 sm:px-10 lg:grid-cols-[220px_1fr]">
        {/* On-this-page nav */}
        <nav className="hidden lg:block">
          <div className="sticky top-14">
            <p className="mb-4 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-600">
              On this page
            </p>
            <ul className="flex flex-col gap-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
              {SECTIONS.map((section, i) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-sm text-zinc-500 transition-colors hover:text-(--main-orange)"
                  >
                    <span className="mr-1.5 text-zinc-400 dark:text-zinc-700">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Sections */}
        <div className="flex flex-col gap-12">
          <Section number={1} id="overview" title="Overview">
            <p>
              Konneqta Pro is a recurring subscription (&ldquo;Pro&rdquo;).
              Because Pro is a digital service with instant access to premium
              features, subscription payments are generally non-refundable
              except in the specific cases listed below. Where a refund is
              required by applicable law, this policy will be applied in line
              with that law.
            </p>
          </Section>

          <Section number={2} id="eligible-for-refund" title="Eligible for a Refund">
            <p>
              You may be eligible for a refund in the following cases:
            </p>
            <ul>
              <li>
                You were charged because of a billing error on our side.
              </li>
              <li>
                You were charged more than once for the same subscription
                period.
              </li>
              <li>
                Your subscription could not be activated due to a technical
                issue caused by Konneqta.
              </li>
              <li>You are entitled to a refund under applicable law.</li>
            </ul>
          </Section>

          <Section
            number={3}
            id="non-refundable-cases"
            title="Non-Refundable Cases"
          >
            <p>The following are not eligible for a refund:</p>
            <ul>
              <li>You changed your mind after subscribing.</li>
              <li>You forgot to cancel before a renewal.</li>
              <li>You did not use the Pro features.</li>
              <li>
                Your account or subscription was suspended or terminated for
                violating our{' '}
                <Link
                  href="/terms"
                  className="text-(--main-orange) hover:underline"
                >
                  Terms of Use
                </Link>
                .
              </li>
            </ul>
          </Section>

          <Section number={4} id="cancellation" title="Cancellation & Renewals">
            <p>
              You can cancel your Konneqta Pro subscription at any time.
              Cancelling stops future renewals — it does not automatically
              refund the current period.
            </p>
            <ul>
              <li>Cancellation prevents the next renewal from being charged.</li>
              <li>
                Your Pro access remains active until the end of the current
                billing period.
              </li>
              <li>
                After the current period ends, your account returns to the Free
                plan.
              </li>
            </ul>
          </Section>

          <Section
            number={5}
            id="how-refunds-are-processed"
            title="How Refunds Are Processed"
          >
            <p>
              Approved refunds are returned to your original payment method. We
              do not guarantee instant or automatic refunds. Processing times
              depend on your payment provider and may take several business
              days after we issue the refund.
            </p>
            <p>
              Payments on Konneqta are processed through Flutterwave. Refunds,
              where approved, are handled by Konneqta in line with
              Flutterwave&rsquo;s processing and settlement timelines.
            </p>
          </Section>

          <Section
            number={6}
            id="requesting-a-refund"
            title="Requesting a Refund"
          >
            <p>
              To request a refund, contact us with the details of your charge.
              Include your account email, the transaction reference, and a
              short description of the issue. Each request is reviewed
              individually, and we will respond in line with this policy.
            </p>
            <p>
              Email:{' '}
              <a
                href="mailto:info@konneqta.com"
                className="text-(--main-orange) hover:underline"
              >
                info@konneqta.com
              </a>
            </p>
          </Section>

          <Section
            number={7}
            id="changes-to-this-refund-policy"
            title="Changes to This Refund Policy"
          >
            <p>
              We may update this Refund Policy from time to time. Any changes
              will be posted on this page with an updated revision date.
            </p>
          </Section>

          <Section number={8} id="governing-law" title="Governing Law">
            <p>
              This Refund Policy shall be governed by and interpreted in
              accordance with the laws of the Federal Republic of Nigeria,
              without regard to conflict of law principles.
            </p>
          </Section>

          <Section number={9} id="contact-us" title="Contact Us">
            <p>
              If you have any questions regarding this Refund Policy, please
              contact us:
              <br />
              Email:{' '}
              <a
                href="mailto:info@konneqta.com"
                className="text-(--main-orange) hover:underline"
              >
                info@konneqta.com
              </a>
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({
  number,
  id,
  title,
  children,
}: {
  number: number;
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-14">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="text-sm font-medium text-(--main-orange)">
          {String(number).padStart(2, '0')}
        </span>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h2>
      </div>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 [&_a]:text-(--main-orange) [&_li]:ml-4 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
    </section>
  );
}