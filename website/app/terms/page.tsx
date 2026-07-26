import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/ui";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "SafeCity Terms and Conditions covering eligibility, safety limits, permissions, evidence, user responsibilities, privacy, and availability.",
};

const termsSections = [
  {
    title: "Agreement and operator",
    content: (
      <>
        <p>
          These Terms govern the deployed SafeCity mobile application and are
          between you and the production operator. The operator&apos;s legal name,
          registered address, support contact, Grievance Officer, and grievance
          contact must be completed before public distribution.
        </p>
        <p>
          By clear affirmative action, you agree to these Terms and acknowledge
          the separate <Link href="/privacy">Privacy Notice</Link>. If you do not
          agree, do not finish setup or start monitoring.
        </p>
        <p>
          The repository&apos;s MIT License governs copying, modification, and
          distribution of source code. These Terms govern use of the deployed
          service and do not remove rights granted by that open-source licence.
        </p>
      </>
    ),
  },
  {
    title: "Eligibility",
    content: (
      <p>
        This build is intended only for people aged 18 or older. By accepting,
        you confirm that you are at least 18 and legally capable of entering this
        agreement. You must have authority to provide an emergency
        contact&apos;s name and number, and should inform them that SafeCity may
        prepare an SOS message addressed to them.
      </p>
    ),
  },
  {
    title: "The service",
    content: (
      <>
        <p>When you start monitoring and allow relevant permissions, SafeCity may:</p>
        <ul>
          <li>analyze short-lived microphone windows and device-motion features;</li>
          <li>use a bundled offline keyword model for direct emergency words and limited threat phrases;</li>
          <li>use bounded context and location for safety assessment and incidents;</li>
          <li>request a check-in or move to an SOS countdown;</li>
          <li>after confirmation, encrypt a 15-second pre-alert tail and collect limited visible-screen evidence;</li>
          <li>store encrypted incident evidence locally;</li>
          <li>open an SMS composer addressed to contacts you chose; and</li>
          <li>display local history, feedback, retention, and deletion controls.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Critical safety limitations",
    content: (
      <>
        <p>SafeCity is an assistive prototype. It is not:</p>
        <ul>
          <li>an emergency service, monitored alarm, law-enforcement, or rescue service;</li>
          <li>a medical device or source of medical, legal, or emergency-response advice;</li>
          <li>guaranteed to detect distress, falls, violence, or emergencies;</li>
          <li>guaranteed to run in the background, obtain location, capture evidence, open a message composer, deliver a message, or obtain a response; or</li>
          <li>a replacement for calling the appropriate emergency number or maintaining other safety arrangements.</li>
        </ul>
        <p>
          Models can miss emergencies and raise false alarms. Phones can suspend
          background work, sensors can fail, and batteries or networks can be
          unavailable. Never delay contacting emergency services because of
          SafeCity.
        </p>
      </>
    ),
  },
  {
    title: "Your responsibilities",
    content: (
      <>
        <p>You agree to:</p>
        <ul>
          <li>keep emergency contacts accurate and current;</li>
          <li>choose permissions deliberately and review sensor health;</li>
          <li>decide when monitoring is appropriate and stop it when it is not;</li>
          <li>review recipients, message content, and location before pressing Send;</li>
          <li>maintain device, app, and operating-system security;</li>
          <li>comply with recording, surveillance, communications, and privacy laws; and</li>
          <li>maintain another way to obtain urgent help.</li>
        </ul>
        <p>
          You must not use SafeCity to unlawfully surveil, record, or track
          someone; harass or impersonate; send a knowingly false emergency
          message; interfere with service security; or violate another
          person&apos;s rights.
        </p>
      </>
    ),
  },
  {
    title: "Permissions, location, evidence, and communications",
    content: (
      <>
        <p>
          The intended production design should request permissions by feature
          and degrade when optional access is denied. The current prototype
          requires all listed permissions during onboarding; this is a known
          release blocker, not an endorsed production behavior.
        </p>
        <p>
          Camera evidence can ordinarily be captured only while SafeCity is
          visible. Evidence remains encrypted in app-private storage unless you
          deliberately share or export it. Keyword accuracy, power use, and
          background continuity vary by device.
        </p>
        <p>
          Safety Navigator uses public Overpass, OpenStreetMap routing, and
          CARTO tile services as described in the Privacy Notice. SMS and
          external-map actions invoke separate third parties. Their terms,
          privacy practices, and carrier or data charges may apply.
        </p>
      </>
    ),
  },
  {
    title: "Privacy",
    content: (
      <p>
        The <Link href="/privacy">SafeCity Privacy Notice</Link> explains data
        categories, purposes, recipients, retention, safeguards, and rights.
        Consent to personal-data processing is separate from agreement to these
        Terms and may be withdrawn in Settings. The production operator must
        ensure actual practices match the published notice.
      </p>
    ),
  },
  {
    title: "On-device inference",
    content: (
      <p>
        The supported build bundles its audio model and risk calculations inside
        the app. Monitoring audio and motion are not sent to a laptop, server, or
        cloud for inference. Modified builds that add remote processing require
        a separate security, privacy, processor, and consent review before use.
      </p>
    ),
  },
  {
    title: "Availability, maintenance, and changes",
    content: (
      <p>
        SafeCity may be updated, suspended, or discontinued. Changes may affect
        sensors, model thresholds, platform compatibility, or evidence behavior.
        An update must not introduce a materially new personal-data purpose
        without updating the Privacy Notice and obtaining consent where
        required.
      </p>
    ),
  },
  {
    title: "Intellectual property and open-source components",
    content: (
      <p>
        Source code is licensed under the repository&apos;s MIT License.
        Third-party software and model components are subject to their own
        licences. Names, logos, and deployed-service content not covered by an
        open-source licence remain owned by their respective owners.
      </p>
    ),
  },
  {
    title: "Disclaimer",
    content: (
      <p>
        To the extent permitted by applicable law, SafeCity is provided without
        a promise that it will be uninterrupted, error-free, accurate, or
        suitable as your only safety measure. Nothing in these Terms excludes or
        limits a warranty, remedy, consumer right, or liability that cannot
        lawfully be excluded or limited under Indian law.
      </p>
    ),
  },
  {
    title: "Liability",
    content: (
      <p>
        The production operator must replace this section with a limitation
        reviewed for the actual commercial model, insurance, risk allocation,
        and mandatory Indian consumer law. No provision may exclude liability
        that applicable law does not permit to be excluded. Counsel-approved
        liability language is required before release.
      </p>
    ),
  },
  {
    title: "Suspension and termination",
    content: (
      <p>
        You may stop using SafeCity at any time and may withdraw consent and
        erase local data through Settings. The operator may suspend access where
        reasonably necessary to address unlawful use, abuse, material security
        risk, or a legal requirement, subject to applicable law and required
        notice.
      </p>
    ),
  },
  {
    title: "Governing law and disputes",
    content: (
      <p>
        These Terms are governed by the laws of India. The production operator
        must publish the applicable city and state for court jurisdiction and
        obtain qualified review of any dispute-resolution or arbitration term.
        Mandatory statutory and consumer forums remain available where
        applicable.
      </p>
    ),
  },
  {
    title: "Grievances",
    content: (
      <p>
        A named Grievance Officer, operational email, and postal address must be
        published before release. Nothing in these Terms prevents access to the
        Data Protection Board of India, a consumer commission, court, or another
        competent authority after following any legally required process.
      </p>
    ),
  },
  {
    title: "General terms",
    content: (
      <p>
        If a provision is unenforceable, it will be limited to the minimum
        necessary and remaining provisions continue. Failure to enforce a
        provision is not a waiver. Transfer of this agreement must not materially
        reduce safety or privacy rights. These Terms and the Privacy Notice form
        the deployed-service agreement alongside terms and rights that law does
        not permit to be excluded.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      effective="25 July 2026"
      introduction={
        <>
          Terms for SafeCity&apos;s assistive mobile safety prototype, including
          eligibility, user responsibilities, permissions, critical safety
          limits, privacy, and availability. Operator details and qualified
          Indian legal review are required before production.
        </>
      }
      label="LEGAL · TERMS & CONDITIONS"
      sections={termsSections}
      title="SafeCity Terms & Conditions"
      version="2026-07-25-v4"
    />
  );
}
