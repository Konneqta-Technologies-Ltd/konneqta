import DarkModeToggle from '@/components/DarkModeToggle';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Konneqta',
  description: 'How Konneqta collects, uses, and protects your information.',
  alternates: { canonical: '/privacy' },
};

const SECTIONS = [
  { id: 'information-we-collect', title: 'Information We Collect' },
  { id: 'how-we-use-your-information', title: 'How We Use Your Information' },
  { id: 'analytics', title: 'Analytics' },
  { id: 'cookies', title: 'Cookies' },
  { id: 'data-protection', title: 'Data Protection' },
  { id: 'sharing-your-information', title: 'Sharing Your Information' },
  { id: 'your-rights', title: 'Your Rights' },
  {
    id: 'changes-to-this-privacy-policy',
    title: 'Changes to This Privacy Policy',
  },
  { id: 'contact-us', title: 'Contact Us' },
];

export default function PrivacyPolicyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-zinc-500">
            Last Updated: July 16, 2026
          </p>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Konneqta (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;)
            values your privacy. This Privacy Policy explains how we collect,
            use, disclose, and safeguard your information when you visit{' '}
            <span className="text-zinc-700 dark:text-zinc-300">
              https://www.konneqta.com
            </span>
            or use our services. By using Konneqta, you agree to the practices
            described in this Privacy Policy.
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
          <Section
            number={1}
            id="information-we-collect"
            title="Information We Collect"
          >
            <p>We may collect the following information:</p>
            <ul>
              <li>Your name</li>
              <li>Email address</li>
              <li>Profile photo/avatar</li>
              <li>Links to social media and websites</li>
              <li>Bio</li>
              <li>QR code associated with their profile</li>
              <li>Any other information they choose to publish</li>
              <li>Job title (if provided)</li>

              <li>
                Information you voluntarily provide through forms or waitlists
              </li>
              <li>Cookies and similar tracking technologies</li>
              <li>Device and browser information</li>
              <li>
                Usage information such as pages visited, time spent on the
                website, and interactions with our services
              </li>
            </ul>
          </Section>

          <Section
            number={2}
            id="how-we-use-your-information"
            title="How We Use Your Information"
          >
            <p>We use your information to:</p>
            <ul>
              <li>Provide and improve our services</li>
              <li>Respond to your inquiries</li>
              <li>Manage waitlists and user accounts</li>
              <li>Send important updates about Konneqta (where permitted)</li>
              <li>Monitor website performance and user experience</li>
              <li>Analyze website traffic and usage trends</li>
            </ul>
          </Section>

          <Section number={3} id="analytics" title="Analytics">
            <p>
              We use analytics tools, including PostHog, Google Analytics, Google Search Console and Vercel Analytics, to
              better understand how visitors use our website. These tools may
              collect information such as:
            </p>
            <ul>
              <li>Pages visited</li>
              <li>Time spent on pages</li>
              <li>Browser and device type</li>
              <li>General geographic location</li>
              <li>Referral sources</li>
              <li>Other Analytic Info...</li>
            </ul>
            <p>
              This information helps us improve our website and user experience.
            </p>
          </Section>

          <Section number={4} id="cookies" title="Cookies">
            <p>
              Our website uses cookies and similar technologies to enhance your
              browsing experience, remember preferences, and analyze website
              traffic. You can manage or disable cookies through your browser
              settings.
            </p>
          </Section>

          <Section number={5} id="data-protection" title="Data Protection">
            <p>
              We implement appropriate technical and organizational measures to
              protect your information against unauthorized access, alteration,
              disclosure, or destruction. However, no method of transmission
              over the internet is completely secure, and we cannot guarantee
              absolute security.
            </p>
          </Section>

          <Section
            number={6}
            id="sharing-your-information"
            title="Sharing Your Information"
          >
            <p>
              We do not sell your personal information. We may share information
              only when:
            </p>
            <ul>
              <li>Required by applicable law</li>
              <li>Necessary to protect our legal rights</li>
              <li>
                Working with trusted service providers who help us operate our
                services (such as analytics or hosting providers)
              </li>
            </ul>
          </Section>

          <Section number={7} id="your-rights" title="Your Rights">
            <p>Depending on your location, you may have the right to:</p>
            <ul>
              <li>Request access to your personal information</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your personal information</li>
              <li>Withdraw consent where applicable</li>
            </ul>
            <p>
              To exercise these rights, contact us at{' '}
              <a
                href="mailto:info@konneqta.com"
                className="text-(--main-orange) hover:underline"
              >
                info@konneqta.com
              </a>
              .
            </p>
          </Section>

          <Section
            number={8}
            id="changes-to-this-privacy-policy"
            title="Changes to This Privacy Policy"
          >
            <p>
              We may update this Privacy Policy from time to time. Any changes
              will be posted on this page with an updated revision date.
            </p>
          </Section>

          <Section number={9} id="contact-us" title="Contact Us">
            <p>
              If you have any questions regarding this Privacy Policy, please
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