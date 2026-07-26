import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { FeaturesHeroVisual } from "@/components/page-hero-visuals";
import { Reveal } from "@/components/reveal";
import { CTA, Eyebrow, PageHero, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Explore SafeCity’s on-device monitoring, safety navigation, encrypted evidence, emergency messaging, and discreet escape tools.",
};

const featureIndex = [
  ["01", "On-device intelligence", "Audio, voice, motion, and local fusion", "#on-device-intelligence"],
  ["02", "SOS & evidence", "Cancelable escalation and encrypted incident capture", "#sos-evidence"],
  ["03", "Safety Navigator", "Nearby places, route context, and anonymous risk zones", "#safety-navigator"],
  ["04", "Escape tools", "Fake call, cover story, timed interruption, and siren", "#escape-tools"],
] as const;

const escapeTools = [
  {
    icon: "voice" as const,
    title: "Interactive fake call",
    copy: "Stage a convincing incoming call with bundled audio or on-device text-to-speech when you need a graceful exit.",
  },
  {
    icon: "timer" as const,
    title: "Timed interruption",
    copy: "Schedule a believable interruption and keep it available as a discreet escape route.",
  },
  {
    icon: "map" as const,
    title: "Cover story",
    copy: "Prepare a simple, plausible reason to leave and pair it with a destination or timed prompt.",
  },
  {
    icon: "audio" as const,
    title: "Local siren",
    copy: "Trigger a loud on-device siren and vibration while monitoring pauses to avoid self-activation.",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        className="features-page-hero"
        copy="A connected set of safety tools—from private on-device sensing to user-controlled evidence, navigation, and discreet ways out."
        eyebrow="PRODUCT · BUILT FOR REAL CONSTRAINTS"
        title={
          <>
            One app. More ways to <em>stay in control.</em>
          </>
        }
        visual={<FeaturesHeroVisual />}
      >
        <div className="button-row">
          <Link className="button" href="/how-it-works">
            See the full flow
            <Icon name="arrow" />
          </Link>
          <Link className="button button-secondary" href="/safety">
            Review safety limits
          </Link>
        </div>
      </PageHero>

      <section className="section feature-index-section">
        <div className="container">
          <div className="feature-index">
            {featureIndex.map(([number, title, copy, href], index) => (
              <Reveal className="feature-index-item" delay={index * 55} key={number}>
                <Link className="feature-index-row" href={href}>
                  <span>{number}</span>
                  <h2>{title}</h2>
                  <p>{copy}</p>
                  <Icon name="chevron" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section product-showcase">
        <div className="container showcase-row" id="on-device-intelligence">
          <Reveal className="showcase-copy">
            <Eyebrow>01 · ON-DEVICE INTELLIGENCE</Eyebrow>
            <h2>Signals become context without becoming a cloud upload.</h2>
            <p>
              SafeCity&apos;s supported monitoring path bundles its audio and
              keyword models into the app. Motion features, suppressor patterns,
              and temporal confirmation turn short-lived readings into a visible
              safety state.
            </p>
            <ul className="feature-points">
              <li><Icon name="check" />Short PCM windows processed in volatile memory</li>
              <li><Icon name="check" />No general speech transcription</li>
              <li><Icon name="check" />No single-sensor ordinary auto-SOS</li>
              <li><Icon name="check" />Live sensor diagnostics and degraded-state reporting</li>
            </ul>
          </Reveal>
          <Reveal className="product-phone-wrap" delay={100}>
            <div className="product-phone product-phone-blue">
              <Image
                alt="SafeCity on-device distress audio diagnostic"
                fill
                sizes="(max-width: 860px) 70vw, 360px"
                src="/product/audio-diagnostic.png"
              />
            </div>
            <div className="showcase-label label-top">
              <Icon name="lock" />
              On-device only
            </div>
            <div className="showcase-label label-bottom">
              <i />
              Sensor ready
            </div>
          </Reveal>
        </div>

        <div className="container showcase-row showcase-row-reverse" id="sos-evidence">
          <Reveal className="showcase-copy">
            <Eyebrow>02 · SOS & EVIDENCE</Eyebrow>
            <h2>A visible escalation, with room to cancel.</h2>
            <p>
              When evidence crosses the configured safety threshold, SafeCity
              moves through a user-visible countdown before incident capture.
              It can preserve a brief encrypted record, but it never claims that
              a message was delivered.
            </p>
            <div className="mini-data-grid">
              <div><span>10 sec</span><p>Cancelable SOS countdown</p></div>
              <div><span>15 sec</span><p>Encrypted pre-alert tail after confirmation</p></div>
              <div><span>2</span><p>Front and rear incident photos when visible</p></div>
              <div><span>You</span><p>Review and press Send in the SMS composer</p></div>
            </div>
          </Reveal>
          <Reveal className="product-phone-wrap" delay={100}>
            <div className="product-phone product-phone-red">
              <Image
                alt="SafeCity protection health dashboard"
                fill
                sizes="(max-width: 860px) 70vw, 360px"
                src="/product/protection-health.png"
              />
            </div>
            <div className="evidence-float">
              <span><Icon name="lock" /></span>
              <p><small>INCIDENT EVIDENCE</small>AES-GCM secured</p>
            </div>
          </Reveal>
        </div>

        <div className="container showcase-row" id="safety-navigator">
          <Reveal className="showcase-copy">
            <Eyebrow>03 · SAFETY NAVIGATOR</Eyebrow>
            <h2>Route with context, not false certainty.</h2>
            <p>
              Nearby mapped facilities, street-lighting signals, and walking
              routes can help you make a more informed choice. Missing map data
              is never treated as proof that an area is unsafe.
            </p>
            <ul className="feature-points">
              <li><Icon name="check" />Nearby mapped police, hospitals, and public places</li>
              <li><Icon name="check" />Route choices and legible walking context</li>
              <li><Icon name="check" />Optional crowd-thresholded community risk zones</li>
              <li><Icon name="check" />Clear third-party map-data disclosures</li>
            </ul>
            <Link className="text-link" href="/privacy">
              See how map data is handled
              <Icon name="arrow" />
            </Link>
          </Reveal>
          <Reveal className="product-phone-wrap" delay={100}>
            <div className="product-phone product-phone-map">
              <Image
                alt="SafeCity Safety Navigator map and route interface"
                fill
                sizes="(max-width: 860px) 70vw, 360px"
                src="/product/safety-navigator.png"
              />
            </div>
            <div className="route-card-float">
              <Icon name="route" />
              <span><small>ROUTE CONTEXT</small>Nearby help mapped</span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section escape-section" id="escape-tools">
        <div className="container">
          <SectionHeading
            copy="Sometimes the safest move is the least visible one. SafeCity includes tools designed to help you leave without escalating a situation."
            eyebrow="04 · DISCREET ESCAPE"
            title={<>A way out that looks <em>ordinary.</em></>}
          />
          <div className="escape-grid">
            <Reveal className="escape-phone-card">
              <div className="escape-phone">
                <Image
                  alt="SafeCity simulated connected fake call"
                  fill
                  sizes="(max-width: 580px) 80vw, 350px"
                  src="/product/fake-call.png"
                />
              </div>
              <div className="escape-phone-note">
                <Icon name="voice" />
                <span><small>FAKE CALL</small>Bundled and offline-ready</span>
              </div>
            </Reveal>
            <div className="escape-tool-grid">
              {escapeTools.map((tool, index) => (
                <Reveal className="escape-tool" delay={index * 60} key={tool.title}>
                  <span><Icon name={tool.icon} /></span>
                  <h3>{tool.title}</h3>
                  <p>{tool.copy}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CTA
        copy="See how signals, confirmation, evidence, and your choices fit together from start to finish."
        eyebrow="FROM SIGNAL TO ACTION"
        title="Understand the complete safety flow."
      />
    </>
  );
}
