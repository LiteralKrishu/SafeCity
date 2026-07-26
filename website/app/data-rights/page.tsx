import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { CTA, Eyebrow, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Your data rights",
  description:
    "Understand SafeCity’s local data categories, access, correction, retention, deletion, and consent-withdrawal controls.",
};

const rights = [
  ["See what is stored", "History and Settings expose incidents, contacts, permissions, consent state, retention, and learned-baseline controls.", "eyeOff", ["History", "Incidents", "Permissions", "Consent"]],
  ["Correct your details", "Update or remove emergency contacts and change protection settings directly on the device.", "message", ["Contacts", "Settings", "Preferences", "On device"]],
  ["Delete an incident", "Remove individual incidents and their encrypted evidence before the selected retention period ends.", "trash", ["Incidents", "Evidence", "Immediate", "Encrypted"]],
  ["Clear the baseline", "Erase optional learned routine aggregates without deleting contacts or incident history.", "motion", ["Learning", "Routine", "Reset", "Local only"]],
  ["Choose retention", "Set local incident retention from 1 to 90 days, with 30 days as the current default.", "timer", ["1–90 days", "30-day default", "Expiry", "Your choice"]],
  ["Withdraw and erase", "Stop monitoring and erase this installation’s SafeCity personal data through one confirmed Settings flow.", "shield", ["Consent", "Contacts", "Incidents", "Full reset"]],
] as const;

const lifecycle = [
  ["Created", "A short signal exists in memory or a setting is entered by you.", "spark"],
  ["Protected", "Durable metadata uses SQLCipher; confirmed evidence uses AES-GCM.", "lock"],
  ["Used", "Local safety states, history, and user-requested actions use the minimum relevant data.", "motion"],
  ["Expired", "Volatile windows disappear quickly; incidents follow your selected retention.", "timer"],
  ["Erased", "Delete one record, clear optional learning, or withdraw consent and erase the installation.", "trash"],
];

export default function DataRightsPage() {
  return (
    <>
      <section className="data-rights-hero">
        <div className="data-rights-grid-bg" />
        <div className="container data-rights-hero-grid">
          <Reveal className="data-rights-hero-copy">
            <Eyebrow>YOUR DATA · YOUR CONTROLS</Eyebrow>
            <h1>
              Privacy you can <em>actually use.</em>
            </h1>
            <p>
              SafeCity&apos;s most important privacy interface is the set of
              controls that lets you inspect, correct, limit, and erase what
              the app keeps.
            </p>
            <div className="button-row">
              <Link className="button" href="/privacy">
                Read the privacy notice
                <Icon name="arrow" />
              </Link>
              <Link className="button button-secondary" href="/terms">
                View terms
              </Link>
            </div>
            <div className="data-rights-promises">
              <span><Icon name="device" />On-device first</span>
              <span><Icon name="timer" />You set retention</span>
              <span><Icon name="trash" />Erase any time</span>
            </div>
          </Reveal>

          <Reveal className="data-control-scene" delay={120}>
            <div className="data-control-orbit orbit-one" />
            <div className="data-control-orbit orbit-two" />
            <div className="data-control-panel">
              <div className="data-control-head">
                <span><Icon name="shield" /></span>
                <div>
                  <small>SAFE CITY · PRIVACY CENTER</small>
                  <strong>Your data</strong>
                </div>
                <b>LOCAL</b>
              </div>
              <div className="data-control-status">
                <span><Icon name="check" /></span>
                <p>
                  <small>CURRENT STATE</small>
                  You are in control
                </p>
              </div>
              <div className="data-control-rows">
                <div>
                  <span>Incident history</span>
                  <strong>30 days</strong>
                </div>
                <div>
                  <span>Learned baseline</span>
                  <strong>Optional</strong>
                </div>
                <div>
                  <span>Cloud safety profile</span>
                  <strong>None</strong>
                </div>
              </div>
              <div className="data-control-erase">
                <Icon name="trash" />
                <span>Erase this installation</span>
                <Icon name="chevron" />
              </div>
            </div>
            <div className="data-control-float data-control-float-top">
              <Icon name="lock" />
              <span><small>EVIDENCE</small>AES-GCM</span>
            </div>
            <div className="data-control-float data-control-float-bottom">
              <Icon name="eyeOff" />
              <span><small>CLOUD PROFILE</small>Not created</span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section rights-section">
        <div className="container">
          <SectionHeading
            copy="Most SafeCity data lives only on the device, so the fastest rights controls live there too."
            eyebrow="DIRECT CONTROLS"
            title={<>Six ways to stay in <em>charge.</em></>}
          />
          <div className="rights-rows">
            {rights.map(([title, copy, icon, tags], index) => (
              <Reveal
                className={`right-row right-row-${index + 1}`}
                delay={index * 45}
                key={title}
              >
                <div className="right-row-tags">
                  {tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <i className="right-row-icon">
                  <Icon name={icon as "eyeOff" | "message" | "trash" | "motion" | "timer" | "shield"} />
                </i>
                <div className="right-row-copy">
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
                <span className="right-row-number">0{index + 1}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section lifecycle-section">
        <div className="container lifecycle-grid">
          <Reveal className="lifecycle-copy">
            <Eyebrow>DATA LIFECYCLE</Eyebrow>
            <h2>From a passing signal to deliberate erasure.</h2>
            <p>
              Different data deserves different lifetimes. Ordinary inference
              should be fleeting; a confirmed incident should be encrypted and
              remain only as long as you choose.
            </p>
          </Reveal>
          <div className="lifecycle-list">
            {lifecycle.map(([title, copy, icon], index) => (
              <Reveal className="lifecycle-row" delay={index * 50} key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <i className="lifecycle-node">
                  <Icon name={icon as "spark" | "lock" | "motion" | "timer" | "trash"} />
                </i>
                <h3>{title}</h3>
                <p>{copy}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section withdrawal-section">
        <div className="container withdrawal-grid">
          <Reveal className="withdrawal-card">
            <span className="withdrawal-icon"><Icon name="trash" /></span>
            <Eyebrow>WITHDRAWAL</Eyebrow>
            <h2>One confirmed action stops processing and resets this installation.</h2>
            <div className="withdrawal-path" aria-label="Settings path">
              <span>Settings</span>
              <Icon name="chevron" />
              <span>Legal & data</span>
              <Icon name="chevron" />
              <strong>Withdraw</strong>
            </div>
            <p>
              In the app, use <strong>Settings → Legal and your data → Withdraw
              consent and erase data</strong>. Monitoring stops and SafeCity
              removes contacts, sessions, incidents, locations, queued anonymous
              reports, consent records, optional learned profiles, and encrypted
              evidence from the installation.
            </p>
          </Reveal>
          <Reveal className="request-card" delay={90}>
            <div className="request-card-orbit" />
            <Eyebrow>FORMAL REQUESTS</Eyebrow>
            <h3>Some rights need an operator.</h3>
            <p>
              Access summaries, grievance handling, nomination, or questions
              about external recipients require a verified support process.
            </p>
            <div className="pre-release-contact">
              <Icon name="spark" />
              <p>
                <strong>Pre-release status</strong>
                The final Data Fiduciary, Privacy Contact, and Grievance Officer
                must be published before distribution.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <CTA
        copy="See every data category, purpose, recipient, retention rule, and safeguard in the complete notice."
        eyebrow="FULL DETAILS"
        title="Read the itemised Privacy Notice."
      />
    </>
  );
}
