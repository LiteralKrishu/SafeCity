import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { TrustHeroVisual } from "@/components/page-hero-visuals";
import { Reveal } from "@/components/reveal";
import { CTA, Eyebrow, PageHero, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Safety & trust",
  description:
    "SafeCity’s safety principles, model boundaries, privacy architecture, platform limits, and third-party map disclosures.",
};

const principles = [
  {
    icon: "shield" as const,
    title: "Assist, never guarantee",
    copy: "SafeCity is not an emergency dispatcher, monitored alarm, medical device, police service, or proof that an incident occurred.",
  },
  {
    icon: "spark" as const,
    title: "Explain the decision",
    copy: "Visible factors, tiered states, and model-version records make an alert reviewable instead of presenting a mystery score.",
  },
  {
    icon: "lock" as const,
    title: "Minimize by architecture",
    copy: "Short-lived signals, bounded local state, encrypted evidence, and user-chosen retention reduce the amount of sensitive data that exists.",
  },
  {
    icon: "check" as const,
    title: "Require agreement",
    copy: "Single-modality events and behavior deviation cannot ordinarily trigger automatic SOS. Independent evidence must agree.",
  },
];

const limits = [
  "Played media may still resemble real distress.",
  "Quiet coercion or medical events may produce no detectable audio or motion.",
  "Phone position, cases, clothing, room noise, and device hardware change signal quality.",
  "Mobile operating systems can stop background work after force-quit, low power, or vendor restrictions.",
  "A model-load failure disables pretrained audio inference and leaves reduced fallback behavior.",
  "Thresholds are pilot defaults and have not been validated on a representative field dataset.",
  "Keyword recognition varies by language, accent, volume, distance, and background sound.",
  "Routine changes, travel, shift work, or GPS drift can look unusual to an adaptive baseline.",
];

const dataPaths = [
  {
    label: "Audio & motion inference",
    destination: "Your phone",
    detail: "Volatile windows; no SafeCity cloud inference request.",
    status: "LOCAL",
  },
  {
    label: "Incident metadata & evidence",
    destination: "Your phone",
    detail: "SQLCipher metadata and AES-GCM files in app-private storage.",
    status: "ENCRYPTED",
  },
  {
    label: "Nearby place lookup",
    destination: "Overpass endpoint",
    detail: "Exact current coordinates when Safety Navigator opens.",
    status: "EXTERNAL",
  },
  {
    label: "Selected walking route",
    destination: "OpenStreetMap routing",
    detail: "Exact origin and destination when a route is requested.",
    status: "EXTERNAL",
  },
  {
    label: "Viewed map tiles",
    destination: "CARTO",
    detail: "Viewed area and ordinary network metadata.",
    status: "EXTERNAL",
  },
  {
    label: "Optional community risk",
    destination: "SafeCity aggregation",
    detail: "Approximate 500 m cell, hourly bucket, category, rotating token.",
    status: "OPT-IN",
  },
];

export default function SafetyPage() {
  return (
    <>
      <PageHero
        className="trust-page-hero"
        copy="Safety technology earns trust by being specific: about what it does, what leaves the phone, what can fail, and what still depends on you."
        eyebrow="TRUST CENTER · NO VAGUE PROMISES"
        title={
          <>
            Built to help. Honest about <em>where it stops.</em>
          </>
        }
        visual={<TrustHeroVisual />}
      >
        <div className="hero-inline-note hero-inline-note-warning">
          <Icon name="spark" />
          <span>
            <small>IMPORTANT</small>
            Do not use SafeCity as your only way to obtain urgent help.
          </span>
        </div>
      </PageHero>

      <section className="section principles-section">
        <div className="container">
          <SectionHeading
            copy="These principles shape product decisions, safety copy, and the way every alert is bounded."
            eyebrow="OUR SAFETY CHARTER"
            title={<>Four rules before any <em>feature.</em></>}
          />
          <div className="principle-grid">
            {principles.map((principle, index) => (
              <Reveal className="principle-card" delay={index * 60} key={principle.title}>
                <span><Icon name={principle.icon} /></span>
                <p>0{index + 1}</p>
                <h3>{principle.title}</h3>
                <div>{principle.copy}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section model-section">
        <div className="container model-grid">
          <Reveal className="model-orbit">
            <div className="model-ring ring-one" />
            <div className="model-ring ring-two" />
            <div className="model-chip chip-a"><Icon name="audio" /><span>YAMNet Lite</span></div>
            <div className="model-chip chip-b"><Icon name="voice" /><span>Keyword model</span></div>
            <div className="model-chip chip-c"><Icon name="motion" /><span>Motion rules</span></div>
            <div className="model-core">
              <Icon name="spark" />
              <small>ON-DEVICE</small>
              <strong>Temporal fusion</strong>
            </div>
          </Reveal>
          <Reveal className="model-copy" delay={100}>
            <Eyebrow>MODEL, NOT MAGIC</Eyebrow>
            <h2>Broad sound classes, narrow safety rules.</h2>
            <p>
              YAMNet is a general environmental-sound classifier, not a
              purpose-trained personal-safety model. Its scores are evidence—not
              calibrated emergency probabilities. Deterministic motion, reviewed
              suppressors, and confirmation rules keep that distinction visible.
            </p>
            <div className="model-facts">
              <div><span>521</span><p>AudioSet classes in the pretrained taxonomy</p></div>
              <div><span>0</span><p>Valid production accuracy claims today</p></div>
              <div><span>2</span><p>Independent modalities for ordinary auto-SOS</p></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section known-limits-section">
        <div className="container">
          <SectionHeading
            copy="These are product constraints, not footnotes. Validation across people, languages, devices, and real environments is still required."
            eyebrow="KNOWN LIMITATIONS"
            title={<>What SafeCity may <em>miss or misread.</em></>}
          />
          <div className="known-limits-grid">
            {limits.map((limit, index) => (
              <Reveal className="known-limit" delay={(index % 4) * 45} key={limit}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{limit}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section data-map-section">
        <div className="container">
          <SectionHeading
            copy="Core inference stays on-device. Map and messaging features invoke outside providers only for the action they perform."
            eyebrow="WHERE DATA GOES"
            title={<>A data path you can <em>actually read.</em></>}
          />
          <Reveal className="data-paths">
            {dataPaths.map((path) => (
              <div className="data-path" key={path.label}>
                <div>
                  <strong>{path.label}</strong>
                  <span>{path.destination}</span>
                </div>
                <p>{path.detail}</p>
                <i className={path.status === "EXTERNAL" ? "status-external" : ""}>{path.status}</i>
              </div>
            ))}
          </Reveal>
          <div className="data-map-links">
            <Link className="text-link" href="/privacy">
              Read the full privacy notice <Icon name="arrow" />
            </Link>
            <Link className="text-link" href="/data-rights">
              See deletion and withdrawal controls <Icon name="arrow" />
            </Link>
          </div>
        </div>
      </section>

      <section className="section platform-section">
        <div className="container platform-grid">
          <Reveal className="platform-copy">
            <Eyebrow>PLATFORM REALITY</Eyebrow>
            <h2>Background protection is not the same everywhere.</h2>
            <p>
              Mobile platforms control what happens after an app leaves the
              screen. SafeCity reports degraded coverage because hiding that
              difference would be a safety bug.
            </p>
          </Reveal>
          <Reveal className="platform-card" delay={70}>
            <p>ANDROID</p>
            <h3>Native foreground-service handoff</h3>
            <span>
              Background rules can continue keyword, conditioned-audio, fall,
              and violent-motion checks, subject to OS and vendor restrictions.
            </span>
          </Reveal>
          <Reveal className="platform-card platform-card-muted" delay={140}>
            <p>iOS · CURRENT PROTOTYPE</p>
            <h3>No equivalent continuous background monitoring</h3>
            <span>
              The React audio and motion loop stops when the current iOS app is
              no longer active. This is a known platform gap.
            </span>
          </Reveal>
        </div>
      </section>

      <CTA
        copy="See the choices built into local storage, retention, correction, erasure, and consent withdrawal."
        eyebrow="YOUR INFORMATION"
        title="Control should be a screen, not a slogan."
      />
    </>
  );
}
