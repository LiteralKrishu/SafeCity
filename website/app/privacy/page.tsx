import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description:
    "SafeCity’s itemised Privacy Notice covering on-device monitoring, evidence, location, mapping recipients, retention, security, and data rights.",
};

const dataRows = [
  ["Emergency-contact name and phone", "Prepare an SOS message to a person you choose", "Encrypted device database", "Until removed, consent withdrawal, or app-data erasure"],
  ["Short microphone windows and rolling 15-second tail", "Detect possible distress; preserve pre-alert audio only after confirmed SOS", "Volatile device memory; bundled model", "Windows are discarded; tail is discarded unless encrypted as evidence"],
  ["Voice trigger and limited threat phrase labels", "Hands-free SOS and limited local phrase checking", "Bundled on-device keyword model", "Ordinary labels are transient; confirmed incident factors follow incident retention"],
  ["Motion features", "Detect fall or struggle patterns and reduce false alarms", "Calculated in volatile device memory", "Ordinary windows are discarded; incident factors follow incident retention"],
  ["Optional behavior baseline", "Use unusual movement, speed, or coarse area only as supporting evidence", "Bounded aggregate profiles in encrypted device storage", "Deleted when disabled, cleared, consent is withdrawn, or app data is erased"],
  ["Coordinates and accuracy", "Incident location, Safety Navigator, route requests, viewed maps, and optional coarse routine cell", "Encrypted device record and relevant public map providers", "Overwritten or erased locally; external providers apply their own retention"],
  ["Optional coarse community-risk contribution", "Create crowd-thresholded anonymous risk zones", "Approximate 500 m cell before transport", "Unsent queue and accepted aggregate input: up to 30 days"],
  ["Incident metadata and feedback", "Display history, explain the alert, and support deletion", "Encrypted device database", "User-selected 1–90 days; default 30 days"],
  ["Confirmed incident evidence", "Preserve a user-authorised incident record", "AES-GCM encrypted app-private files", "Same as incident; earlier deletion available"],
  ["Consent and legal versions", "Record choices and notice shown", "Encrypted device database", "Until withdrawal or app-data erasure"],
];

const privacySections = [
  {
    title: "Data Fiduciary and contact details",
    content: (
      <>
        <p>
          A production deployment must publish the legal name, registered
          address, privacy contact, Grievance Officer, grievance email, and
          applicable postal address of the person or organisation that
          determines why and how SafeCity personal data is processed.
        </p>
        <p>
          <strong>
            SafeCity must not be publicly distributed until these details are
            complete and operational.
          </strong>
        </p>
      </>
    ),
  },
  {
    title: "Scope",
    content: (
      <p>
        This notice applies to the SafeCity mobile app and personal data
        processed for monitoring, SOS, evidence, support, privacy-rights, and
        security functions. It does not govern a mobile operating system,
        telecom carrier, SMS app, mapping provider, or emergency service acting
        for its own purposes; those parties provide their own notices.
      </p>
    ),
  },
  {
    title: "Personal data, purposes, and retention",
    content: (
      <>
        <div className="legal-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Personal data</th>
                <th>Purpose</th>
                <th>Where handled</th>
                <th>Retention</th>
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell) => <td key={cell}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          SafeCity does not collect a contact list, advertising identifier,
          account password, payment data, or continuous video. The repository
          contains no advertising SDK, data sale, or targeted-advertising flow.
        </p>
      </>
    ),
  },
  {
    title: "Purposes, consent, and current pre-release variance",
    content: (
      <>
        <p>
          The intended production basis for monitoring audio, motion, location,
          optional behavior baselining, incident evidence, and associated
          identifiers is free, specific, informed, unconditional, and
          unambiguous consent through clear affirmative action. Operating-system
          permissions are separate controls.
        </p>
        <p>
          The current prototype does not yet fully meet that intended design:
          onboarding requires all listed permissions and combines several
          purposes. Production must split optional processing, default optional
          features off, and correct map disclosures before relying on this
          consent model.
        </p>
        <p>
          Emergency-contact details are voluntarily provided to prepare an SOS
          message. You should inform the contact. SafeCity does not silently send
          the message; the system composer requires you to press <strong>Send</strong>.
        </p>
      </>
    ),
  },
  {
    title: "Processors, recipients, and disclosures",
    content: (
      <>
        <p>Personal data may be handled by the following parties:</p>
        <ol>
          <li><strong>Mobile operating-system provider:</strong> permissions, protected keys, notifications, camera, microphone, motion, and location.</li>
          <li><strong>SMS and telecom providers and chosen recipients:</strong> message content and included location after you press Send.</li>
          <li><strong>External mapping applications:</strong> coordinates when you deliberately open or share a map link.</li>
          <li><strong>OpenStreetMap Overpass endpoints:</strong> exact current coordinates when Safety Navigator requests nearby places and lighting.</li>
          <li><strong>OpenStreetMap routing:</strong> exact origin and destination when you request a walking route.</li>
          <li><strong>CARTO:</strong> viewed map-tile area and ordinary network metadata.</li>
          <li><strong>SafeCity anonymous-risk aggregation:</strong> only after separate opt-in, an approximate 500 m cell, hourly bucket, trigger category, and rotating deduplication token.</li>
          <li><strong>Authorities:</strong> only where disclosure is legally required and documented by the production operator.</li>
        </ol>
        <p>
          No SafeCity-hosted evidence upload, cloud monitoring inference,
          advertising SDK, or analytics SDK exists in this repository.
        </p>
      </>
    ),
  },
  {
    title: "Cross-border processing",
    content: (
      <p>
        Supported inference stays inside the phone. Operating-system, SMS,
        telecom, and mapping providers may process data outside India under
        their own arrangements. Before production, the operator must inventory
        each transfer, comply with applicable restrictions or localisation
        rules, and publish countries and safeguards. Raw monitoring audio must
        not be moved to an unreviewed remote service without a new data-flow,
        security, notice, processor, and consent review.
      </p>
    ),
  },
  {
    title: "Retention and erasure",
    content: (
      <ul>
        <li>Ordinary monitoring windows and inference results remain in volatile memory and are discarded.</li>
        <li>The rolling 15-second tail is discarded when monitoring stops unless a confirmed SOS encrypts it as evidence.</li>
        <li>Optional behavior profiles are bounded encrypted aggregates and are deleted when the feature is disabled or cleared.</li>
        <li>Incidents and evidence follow the 1–90 day period selected in Settings, with earlier deletion available.</li>
        <li>Contacts and consent records remain until removed, consent is withdrawn, or app data is erased.</li>
        <li>Queued anonymous-risk reports and accepted aggregate input are retained no more than 30 days.</li>
        <li>Longer retention is permitted only where law requires it and the operator documents and segregates the record.</li>
      </ul>
    ),
  },
  {
    title: "Security safeguards",
    content: (
      <>
        <p>The current architecture includes:</p>
        <ul>
          <li>SQLCipher encryption for durable mobile metadata;</li>
          <li>random 256-bit database and evidence keys in platform-protected storage;</li>
          <li>AES-GCM encryption for incident evidence;</li>
          <li>app-private files and deletion of temporary plaintext capture files;</li>
          <li>in-memory monitoring audio with no inference network request or audio cache;</li>
          <li>an app-bundled model and local fusion rules;</li>
          <li>bounded local retention and individual/bulk erasure;</li>
          <li>coarse-cell conversion, rotating tokens, and minimum crowd thresholds for optional risk zones.</li>
        </ul>
        <p>
          Production still requires secure signing, dependency and model
          provenance review, key lifecycle controls, vulnerability management,
          incident response, and periodic mobile security testing.
        </p>
      </>
    ),
  },
  {
    title: "Personal-data breaches",
    content: (
      <p>
        The production Data Fiduciary must maintain an incident-response process
        that can notify affected people without delay, explain likely impact and
        protective steps, notify the Data Protection Board of India as
        applicable, provide required details within the prescribed period, and
        investigate and prevent recurrence. A named 24×7 operational owner must
        be published before release.
      </p>
    ),
  },
  {
    title: "Your rights and grievance redressal",
    content: (
      <>
        <p>Subject to applicable law, you may:</p>
        <ul>
          <li>request a summary of personal data and processing activity;</li>
          <li>request applicable identities of other fiduciaries and processors;</li>
          <li>correct, complete, or update personal data;</li>
          <li>erase data no longer required by purpose or law;</li>
          <li>withdraw consent as easily as it was given;</li>
          <li>raise a grievance; and</li>
          <li>nominate another person to exercise rights after death or incapacity.</li>
        </ul>
        <p>
          Local access, correction, and erasure controls are described on the{" "}
          <Link href="/data-rights">Data Rights page</Link>. The operator must
          publish and staff a verified request and grievance process before
          public distribution. Do not send unencrypted incident evidence through
          ordinary email.
        </p>
      </>
    ),
  },
  {
    title: "Withdrawal of consent",
    content: (
      <p>
        Use <strong>Settings → Legal and your data → Withdraw consent and erase
        data</strong>. SafeCity stops monitoring and deletes this
        installation&apos;s contacts, sessions, incidents, locations, queued
        anonymous reports, anonymous secret, consent records, optional learned
        profiles, and encrypted evidence, then returns to onboarding. Withdrawal
        does not affect lawful earlier processing or retention required by law.
      </p>
    ),
  },
  {
    title: "Children",
    content: (
      <p>
        This build is restricted to people aged 18 or older and does not
        implement verifiable parental consent. It must not be offered to a child
        until qualified counsel reviews the use case and the operator implements
        the required parental-consent, due-diligence, child-wellbeing, tracking,
        and behavioral-monitoring safeguards.
      </p>
    ),
  },
  {
    title: "Language and accessibility",
    content: (
      <p>
        Production consent and notices must be clear, accessible, and available
        in the language choices required by applicable law. The app includes
        English, Hindi, and Bengali interface strings, but professionally
        translated legal notices and accessibility testing remain release work.
      </p>
    ),
  },
  {
    title: "Changes to this notice",
    content: (
      <p>
        The version and effective date appear above. If a change materially
        alters personal-data categories, purposes, recipients, or choice,
        SafeCity must present the updated notice and obtain fresh consent before
        the new processing begins. Product and legal teams must keep the app,
        website, store disclosures, and actual deployment aligned.
      </p>
    ),
  },
  {
    title: "Legal framework for this draft",
    content: (
      <>
        <p>
          This deployment template was prepared for readiness under India&apos;s
          Digital Personal Data Protection Act, 2023 and Digital Personal Data
          Protection Rules, 2025. It is not legal advice or a compliance
          conclusion.
        </p>
        <ul>
          <li><a href="https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf">Digital Personal Data Protection Act, 2023 — MeitY</a></li>
          <li><a href="https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf">Digital Personal Data Protection Rules, 2025 — MeitY</a></li>
          <li><a href="https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf">Commencement notification G.S.R. 843(E) — MeitY</a></li>
        </ul>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      effective="25 July 2026"
      introduction={
        <>
          The itemised notice for SafeCity&apos;s mobile monitoring, SOS,
          evidence, maps, retention, security, and data-rights architecture.
          Operator details and qualified Indian legal review are required before
          production.
        </>
      }
      label="LEGAL · PRIVACY NOTICE"
      sections={privacySections}
      title="SafeCity Privacy Notice"
      version="2026-07-25-v5"
    />
  );
}
