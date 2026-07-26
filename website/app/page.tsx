import Link from "next/link";
import { HeroScene } from "@/components/hero-scene";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { DOWNLOAD_URL } from "@/components/site-links";
import { CTA, Eyebrow, SectionHeading } from "@/components/ui";

const pillars = [
  {
    icon: "audio" as const,
    label: "01 · SENSE",
    title: "Short signals. Local decisions.",
    copy: "Microphone and motion windows are analyzed on your phone. Ordinary assessment windows are discarded instead of becoming a cloud archive.",
    detail: "YAMNet Lite · motion features · local fusion",
  },
  {
    icon: "shield" as const,
    label: "02 · VERIFY",
    title: "More than one signal.",
    copy: "SafeCity combines independent evidence and temporal confirmation to reduce single-sensor panic. Context can support a decision, never create one.",
    detail: "Audio + motion · suppressor patterns · countdown",
  },
  {
    icon: "message" as const,
    label: "03 · ACT",
    title: "You keep the final say.",
    copy: "A visible, cancelable SOS flow can prepare encrypted evidence and open a message to your chosen contacts. You review and press Send.",
    detail: "10-second countdown · encrypted evidence · user send",
  },
];

const features = [
  {
    icon: "voice" as const,
    eyebrow: "ON-DEVICE VOICE",
    title: "A private ear for moments that matter.",
    copy: "Bundled audio and keyword models look for a limited set of distress cues without cloud transcription or a network inference call.",
    className: "feature-card-wide feature-audio",
    visual: (
      <div className="mini-spectrum" aria-hidden="true">
        {Array.from({ length: 30 }).map((_, index) => (
          <i
            key={index}
            style={{ height: `${14 + ((index * 23) % 64)}%` }}
          />
        ))}
      </div>
    ),
  },
  {
    icon: "motion" as const,
    eyebrow: "MULTI-SIGNAL FUSION",
    title: "Motion adds context, not certainty.",
    copy: "Free-fall, impact, jerk, and rotation patterns support audio evidence. A fall alone does not automatically trigger SOS.",
    className: "feature-motion",
    visual: (
      <div className="motion-trace" aria-hidden="true">
        <span />
        <i />
        <b>impact</b>
      </div>
    ),
  },
  {
    icon: "route" as const,
    eyebrow: "SAFETY NAVIGATOR",
    title: "See useful places, lighting, and route context.",
    copy: "Find mapped safe havens and compare routes with clear disclosures when public map services receive location data.",
    className: "feature-route",
    visual: (
      <div className="route-mini" aria-hidden="true">
        <i className="route-dot start" />
        <span />
        <i className="route-dot end" />
      </div>
    ),
  },
  {
    icon: "lock" as const,
    eyebrow: "ENCRYPTED EVIDENCE",
    title: "Saved only after confirmation.",
    copy: "A confirmed incident can encrypt a short pre-alert audio tail, photos, and post-SOS audio in app-private storage.",
    className: "feature-card-wide feature-evidence",
    visual: (
      <div className="evidence-stack" aria-hidden="true">
        <span><Icon name="audio" />15 sec pre-alert</span>
        <span><Icon name="device" />2 incident photos</span>
        <span><Icon name="lock" />AES-GCM encrypted</span>
      </div>
    ),
  },
];

const truths = [
  ["Primary inference", "On device", "No monitoring audio is sent to a SafeCity cloud model."],
  ["Ordinary auto-SOS", "Two signals", "Audio–motion agreement and temporal confirmation are required."],
  ["Evidence retention", "1–90 days", "Choose a local retention window and erase sooner at any time."],
  ["Pre-alert buffer", "15 seconds", "Held in RAM, discarded unless an SOS is confirmed."],
];

const faqs = [
  [
    "Does SafeCity continuously record me?",
    "No. It analyzes short audio windows in volatile memory. A rolling 15-second tail is discarded unless a confirmed SOS turns it into encrypted evidence.",
  ],
  [
    "Can it contact emergency services automatically?",
    "No. SafeCity is not a dispatcher. It can open the system message composer for contacts you choose, but you must review and press Send.",
  ],
  [
    "Will protection always run in the background?",
    "No mobile platform can guarantee that. Android can hand work to a foreground service, while the current iOS prototype does not provide equivalent continuous background protection.",
  ],
  [
    "Can I delete what SafeCity stores?",
    "Yes. Incidents can be deleted individually, the learned baseline can be cleared, and consent withdrawal erases this installation’s local SafeCity data.",
  ],
];

export default function HomePage() {
  return (
    <>
      <section className="home-hero">
        <div className="hero-ambient" />
        <div className="container home-hero-grid">
          <Reveal className="hero-copy">
            <Eyebrow>PRIVATE BY DESIGN · ON-DEVICE AI</Eyebrow>
            <h1>
              Safety that <em>listens.</em>
              <span className="hero-question">Only when you ask.</span>
            </h1>
            <p>
              SafeCity combines audio, motion, and careful safety rules on your
              phone—then gives you a clear, cancelable path to act.
            </p>
            <div className="button-row">
              <a className="button button-primary" href={DOWNLOAD_URL}>
                Download APK
                <Icon name="arrow" />
              </a>
              <Link className="button button-secondary" href="/features">
                Explore protection
                <Icon name="arrow" />
              </Link>
            </div>
            <div className="hero-trust">
              <span>
                <Icon name="lock" />
                No cloud inference
              </span>
              <span>
                <Icon name="eyeOff" />
                No continuous video
              </span>
            </div>
          </Reveal>
          <Reveal className="hero-visual" delay={140}>
            <HeroScene />
          </Reveal>
        </div>
        <div className="container hero-caption">
          <span>SCROLL TO DISCOVER</span>
          <i />
          <p>Assistive prototype · Never your only way to get help</p>
        </div>
      </section>

      <section className="thesis-section section">
        <div className="container thesis-grid">
          <Reveal>
            <Eyebrow>THE BELIEF</Eyebrow>
          </Reveal>
          <Reveal className="thesis-copy" delay={100}>
            <h2>
              Protection should feel like <em>agency</em>, not surveillance.
            </h2>
            <p>
              Your most vulnerable moments should not become someone else&apos;s
              dataset. SafeCity keeps its primary intelligence on your device,
              explains what it sees, and lets you stop, delete, or withdraw.
            </p>
          </Reveal>
        </div>
        <div className="container truth-grid">
          {truths.map(([label, value, copy], index) => (
            <Reveal className="truth-card" delay={index * 70} key={label}>
              <p>{label}</p>
              <strong>{value}</strong>
              <span>{copy}</span>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="process-section section">
        <div className="container">
          <SectionHeading
            align="center"
            copy="Three moments shape SafeCity—from a short-lived signal to a user-controlled action."
            eyebrow="HOW PROTECTION MOVES"
            title={
              <>
                Sense. Verify. <em>Act.</em>
              </>
            }
          />
          <div className="pillar-grid">
            {pillars.map((pillar, index) => (
              <Reveal className="pillar-card" delay={index * 90} key={pillar.title}>
                <div className="pillar-top">
                  <span>{pillar.label}</span>
                  <i>
                    <Icon name={pillar.icon} />
                  </i>
                </div>
                <h3>{pillar.title}</h3>
                <p>{pillar.copy}</p>
                <div className="pillar-detail">{pillar.detail}</div>
              </Reveal>
            ))}
          </div>
          <Reveal className="center-link">
            <Link href="/how-it-works">
              Follow the complete safety flow
              <Icon name="arrow" />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="features-section section">
        <div className="container">
          <SectionHeading
            copy="Purpose-built tools for detection, context, escape, evidence, and control—without pretending a phone can guarantee safety."
            eyebrow="THE PRODUCT"
            title={
              <>
                Calm technology for <em>hard moments.</em>
              </>
            }
          />
          <div className="feature-bento">
            {features.map((feature, index) => (
              <Reveal
                className={`feature-card ${feature.className}`}
                delay={(index % 2) * 80}
                key={feature.title}
              >
                <div className="feature-card-head">
                  <span>
                    <Icon name={feature.icon} />
                  </span>
                  <p>{feature.eyebrow}</p>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
                {feature.visual}
              </Reveal>
            ))}
          </div>
          <Reveal className="center-link">
            <Link href="/features">
              Explore every feature
              <Icon name="arrow" />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="privacy-home section">
        <div className="container privacy-home-grid">
          <Reveal className="privacy-home-copy">
            <Eyebrow>PRIVACY, MADE VISIBLE</Eyebrow>
            <h2>
              Your data stays <em>close.</em>
            </h2>
            <p>
              Local processing is not a footnote—it is the architecture.
              Monitoring windows stay volatile, durable metadata is encrypted,
              and user-facing controls make retention and erasure tangible.
            </p>
            <ul className="check-list">
              <li><Icon name="check" />SQLCipher-encrypted local metadata</li>
              <li><Icon name="check" />AES-GCM incident evidence</li>
              <li><Icon name="check" />No ads, data brokers, or analytics SDK</li>
              <li><Icon name="check" />Clear consent withdrawal and erasure</li>
            </ul>
            <Link className="text-link" href="/data-rights">
              See your data controls
              <Icon name="arrow" />
            </Link>
          </Reveal>
          <Reveal className="privacy-vault" delay={120}>
            <div className="vault-rings">
              <i />
              <i />
              <i />
            </div>
            <div className="vault-core">
              <Icon name="lock" />
              <span>LOCAL</span>
              <strong>Encrypted on device</strong>
            </div>
            <div className="vault-tag vault-tag-one">VOLATILE AUDIO</div>
            <div className="vault-tag vault-tag-two">USER DELETABLE</div>
            <div className="vault-tag vault-tag-three">NO AD ID</div>
          </Reveal>
        </div>
      </section>

      <section className="limits-section section">
        <div className="container limits-grid">
          <Reveal className="limits-card">
            <p className="limits-index">01</p>
            <span className="limits-icon"><Icon name="device" /></span>
            <h3>It cannot guarantee detection.</h3>
            <p>
              Quiet events, device position, background restrictions, or sensor
              failure can all cause SafeCity to miss a dangerous moment.
            </p>
          </Reveal>
          <Reveal className="limits-intro" delay={80}>
            <Eyebrow>TRUST MEANS TELLING THE WHOLE STORY</Eyebrow>
            <h2>Designed to assist. Never to overpromise.</h2>
            <p>
              Safety technology should be judged by the constraints it admits,
              not just the features it advertises.
            </p>
            <Link className="button button-secondary" href="/safety">
              Read safety & model limits
              <Icon name="arrow" />
            </Link>
          </Reveal>
          <Reveal className="limits-card" delay={160}>
            <p className="limits-index">02</p>
            <span className="limits-icon"><Icon name="message" /></span>
            <h3>It cannot guarantee a response.</h3>
            <p>
              SafeCity opens a composer; you press Send. Networks, recipients,
              and emergency services remain outside the app&apos;s control.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="faq-section section">
        <div className="container faq-grid">
          <SectionHeading
            copy="Clear answers about monitoring, evidence, messaging, and background behavior."
            eyebrow="COMMON QUESTIONS"
            title={<>Good safety starts with <em>clarity.</em></>}
          />
          <div className="faq-list">
            {faqs.map(([question, answer], index) => (
              <Reveal delay={index * 50} key={question}>
                <details>
                  <summary>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {question}
                    <i>+</i>
                  </summary>
                  <p>{answer}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CTA />
    </>
  );
}
