import Link from 'next/link';
import DarkModeToggle from '@/components/DarkModeToggle';

export const metadata = {
  title: 'Terms of Use — Konneqta',
  description: 'The terms governing your access to and use of Konneqta.',
};

const SECTIONS = [
  { id: 'acceptance-of-terms', title: 'Acceptance of Terms' },
  { id: 'our-services', title: 'Our Services' },
  { id: 'user-responsibilities', title: 'User Responsibilities' },
  { id: 'intellectual-property', title: 'Intellectual Property' },
  { id: 'acceptable-use', title: 'Acceptable Use' },
  { id: 'user-content', title: 'User Content' },
  { id: 'third-party-services', title: 'Third-Party Services' },
  { id: 'disclaimer', title: 'Disclaimer' },
  { id: 'limitation-of-liability', title: 'Limitation of Liability' },
  { id: 'suspension-or-termination', title: 'Suspension or Termination' },
  { id: 'changes-to-these-terms', title: 'Changes to These Terms' },
  { id: 'governing-law', title: 'Governing Law' },
  { id: 'contact-us', title: 'Contact Us' },
];

export default function TermsOfUsePage() {
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
            Terms of Use
          </h1>
          <p className="mt-3 text-sm text-zinc-500">
            Last Updated: July 16, 2026
          </p>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Welcome to Konneqta. These Terms of Use govern your access to and
            use of{' '}
            <span className="text-zinc-700 dark:text-zinc-300">
              https://www.konneqta.com
            </span>{' '}
            and any related services provided by Konneqta. By accessing or using
            our website or services, you agree to be bound by these Terms.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 px-6 py-14 sm:px-10 lg:grid-cols-[220px_1fr]">
        {/* On-this-page nav */}
        <nav className="hidden lg:block">
          <div className="sticky top-14">
            3
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
          <Section
            number={1}
            id="acceptance-of-terms"
            title="Acceptance of Terms"
          >
            <p>
              By using Konneqta, you confirm that you have read, understood, and
              agreed to these Terms of Use. If you do not agree with these
              Terms, please do not use our services.
            </p>
          </Section>

          <Section number={2} id="our-services" title="Our Services">
            <p>
              Konneqta provides digital identity and networking tools that allow
              users to create, manage, and share professional profiles, contact
              information, and related content. We may modify, improve, or
              discontinue features at any time.
            </p>
          </Section>

          <Section
            number={3}
            id="user-responsibilities"
            title="User Responsibilities"
          >
            <p>You agree to:</p>
            <ul>
              <li>Provide accurate information.</li>
              <li>Keep your account information secure.</li>
              <li>Use the platform lawfully.</li>
              <li>Respect the rights of other users.</li>
              <li>
                Avoid uploading unlawful, harmful, fraudulent, or misleading
                content.
              </li>
            </ul>
            <p>
              You are responsible for all activity conducted through your
              account.
            </p>
          </Section>

          <Section
            number={4}
            id="intellectual-property"
            title="Intellectual Property"
          >
            <p>
              All content, branding, logos, software, designs, and technology
              associated with Konneqta are the property of Konneqta unless
              otherwise stated. You may not copy, reproduce, distribute, modify,
              or exploit any part of the platform without prior written
              permission.
            </p>
          </Section>

          <Section number={5} id="acceptable-use" title="Acceptable Use">
            <p>You agree not to:</p>
            <ul>
              <li>Attempt unauthorized access to our systems.</li>
              <li>Interfere with the operation or security of the platform.</li>
              <li>
                Use automated tools to scrape or harvest data without
                permission.
              </li>
              <li>Use Konneqta for illegal or fraudulent activities.</li>
              <li>Upload malicious software or harmful code.</li>
            </ul>
          </Section>

          <Section number={6} id="user-content" title="User Content">
            <p>
              You retain ownership of the content you upload to Konneqta. By
              uploading content, you grant Konneqta a limited license to host,
              store, display, and process that content solely for the purpose of
              providing the service. You are solely responsible for the content
              you publish.
            </p>
          </Section>

          <Section
            number={7}
            id="third-party-services"
            title="Third-Party Services"
          >
            <p>
              Konneqta may integrate or link to third-party services. We are not
              responsible for the content, policies, or practices of those third
              parties.
            </p>
          </Section>

          <Section number={8} id="disclaimer" title="Disclaimer">
            <p>
              Konneqta is provided on an &ldquo;as is&rdquo; and &ldquo;as
              available&rdquo; basis. While we strive to provide reliable
              services, we do not guarantee uninterrupted availability,
              error-free operation, or that the service will meet every
              user&apos;s expectations.
            </p>
          </Section>

          <Section
            number={9}
            id="limitation-of-liability"
            title="Limitation of Liability"
          >
            <p>
              To the maximum extent permitted by law, Konneqta shall not be
              liable for any indirect, incidental, special, consequential, or
              punitive damages arising from the use of our services.
            </p>
          </Section>

          <Section
            number={10}
            id="suspension-or-termination"
            title="Suspension or Termination"
          >
            <p>
              We reserve the right to suspend or terminate accounts that violate
              these Terms or misuse the platform.
            </p>
          </Section>

          <Section
            number={11}
            id="changes-to-these-terms"
            title="Changes to These Terms"
          >
            <p>
              We may update these Terms from time to time. Continued use of the
              platform after changes become effective constitutes acceptance of
              the updated Terms.
            </p>
          </Section>

          <Section number={12} id="governing-law" title="Governing Law">
            <p>
              These Terms shall be governed by and interpreted in accordance
              with the laws of the Federal Republic of Nigeria, without regard
              to conflict of law principles.
            </p>
          </Section>

          <Section number={13} id="contact-us" title="Contact Us">
            <p>
              For any questions regarding these Terms, please contact us:
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
