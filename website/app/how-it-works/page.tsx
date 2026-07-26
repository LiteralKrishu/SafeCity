import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { FlowHeroVisual } from "@/components/page-hero-visuals";
import { Reveal } from "@/components/reveal";
import { CTA, Eyebrow, PageHero, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Follow SafeCity’s on-device monitoring, multi-signal confirmation, cancelable SOS, evidence, and user-controlled messaging flow.",
};

const flow = [
  {
    number: "01",
    label: "START",
    title: "You choose when protection begins.",
    copy: "Monitoring starts only after setup, permissions, and consent. The dashboard shows whether audio, motion, location, and background coverage are ready or degraded.",
    icon: "device" as const,
  },
  {
    number: "02",
    label: "SENSE",
    title: "The phone checks short-lived signals.",
    copy: "Bundled audio intelligence, motion features, and optional voice triggers work locally. Ordinary audio windows and fusion state expire instead of becoming a remote activity log.",
    icon: "audio" as const,
  },
  {
    number: "03",
    label: "VERIFY",
    title: "Independent evidence must agree.",
    copy: "SafeCity looks for audio–motion agreement across time and retrieves reviewed suppressors such as media playback, transport vibration, or a dropped phone.",
    icon: "motion" as const,
  },
  {
    number: "04",
    label: "CHECK IN",
    title: "You get a visible chance to respond.",
    copy: "A tiered state can surface a check-in or a cancelable SOS countdown. The interface explains factors and keeps emergency action within reach.",
    icon: "timer" as const,
  },
  {
    number: "05",
    label: "ACT",
    title: "A confirmed SOS prepares help, not promises.",
    copy: "The app may encrypt limited incident evidence and open the system message composer. You review recipients and content, then press Send.",
    icon: "message" as const,
  },
];

const decisionRows = [
  ["Audio only", "Check-in / alert", "Cannot ordinarily auto-SOS by itself"],
  ["Motion only", "Check-in / alert", "A fall alone cannot ordinarily auto-SOS"],
  ["Behavior deviation only", "No independent alert", "Supporting evidence only"],
  ["Audio + motion, confirmed", "SOS countdown", "Requires agreement across windows"],
  ["Extreme scream + fall-impact", "Faster escalation", "Exceptional configured path"],
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        className="flow-page-hero"
        copy="A safety system is only trustworthy when its decisions can be followed. Here is the complete path from user consent to a possible SOS."
        eyebrow="THE SAFETY FLOW · EXPLAINED"
        title={
          <>
            From a short signal to a <em>clear next step.</em>
          </>
        }
        visual={<FlowHeroVisual />}
      >
        <div className="hero-inline-note">
          <Icon name="shield" />
          <span>
            <small>CORE PRINCIPLE</small>
            No time, place, or behavior context can create a threat on its own.
          </span>
        </div>
      </PageHero>

      <section className="section flow-section">
        <div className="container">
          <SectionHeading
            copy="Each stage has a narrow job. The app checks system health, limits stored data, and keeps escalation visible."
            eyebrow="FIVE STAGES"
            title={<>Protection with a <em>human in the loop.</em></>}
          />
          <div className="flow-list">
            {flow.map((item, index) => (
              <Reveal className="flow-item" delay={index * 45} key={item.number}>
                <div className="flow-number">{item.number}</div>
                <div className="flow-icon"><Icon name={item.icon} /></div>
                <div className="flow-copy">
                  <p>{item.label}</p>
                  <h3>{item.title}</h3>
                  <span>{item.copy}</span>
                </div>
                <div className="flow-line" />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section fusion-section">
        <div className="container fusion-grid">
          <Reveal className="fusion-copy">
            <Eyebrow>WHY FUSION MATTERS</Eyebrow>
            <h2>
              A shout is not always danger. A dropped phone is not always a fall.
            </h2>
            <p>
              SafeCity deliberately asks independent signals to agree. It also
              looks for evidence that lowers risk—like television audio or
              routine transport vibration—before escalating.
            </p>
            <Link className="text-link" href="/safety">
              Read the model card summary
              <Icon name="arrow" />
            </Link>
          </Reveal>
          <Reveal className="fusion-visual" delay={100}>
            <div className="fusion-node node-a">
              <Icon name="audio" />
              <span><small>SIGNAL A</small>Audio distress</span>
            </div>
            <div className="fusion-node node-b">
              <Icon name="motion" />
              <span><small>SIGNAL B</small>Motion pattern</span>
            </div>
            <div className="fusion-node node-c">
              <Icon name="eyeOff" />
              <span><small>SUPPRESSORS</small>Playback · transit</span>
            </div>
            <div className="fusion-core">
              <Icon name="spark" />
              <small>LOCAL FUSION</small>
              <strong>Verify across time</strong>
            </div>
            <div className="fusion-output">
              <i />
              <span><small>VISIBLE OUTPUT</small>Safe · Watch · Alert · SOS</span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section decision-section">
        <div className="container">
          <SectionHeading
            copy="This simplified matrix describes the current policy intent. Pilot thresholds are not field-certified accuracy claims."
            eyebrow="DECISION BOUNDARIES"
            title={<>What can—and cannot—<em>escalate.</em></>}
          />
          <Reveal className="decision-table">
            <div className="decision-row decision-head">
              <span>Observed pattern</span>
              <span>Possible result</span>
              <span>Boundary</span>
            </div>
            {decisionRows.map((row) => (
              <div className="decision-row" key={row[0]}>
                <strong>{row[0]}</strong>
                <span>{row[1]}</span>
                <p>{row[2]}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="section evidence-flow-section">
        <div className="container">
          <SectionHeading
            align="center"
            copy="Evidence capture is a separate, confirmed workflow. Mobile operating systems prevent background apps from silently opening cameras."
            eyebrow="AFTER SOS CONFIRMATION"
            title={<>A small encrypted record. <em>Nothing continuous.</em></>}
          />
          <div className="evidence-flow">
            {[
              ["01", "RAM tail", "The latest 15 seconds of audio exists only in volatile memory before confirmation.", "audio"],
              ["02", "Protected capture", "While the capture screen is visible, the app can collect front/rear photos and post-SOS audio.", "device"],
              ["03", "Local encryption", "Evidence is AES-GCM encrypted and temporary plaintext capture files are deleted.", "lock"],
              ["04", "Your action", "You choose whether to open a message, share evidence, or delete the incident.", "message"],
            ].map(([number, title, copy, icon], index) => (
              <Reveal className="evidence-flow-card" delay={index * 70} key={number}>
                <span className="evidence-flow-number">{number}</span>
                <i><Icon name={icon as "audio" | "device" | "lock" | "message"} /></i>
                <h3>{title}</h3>
                <p>{copy}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CTA
        copy="The architecture is private by design, but no phone can promise detection or response. See the constraints SafeCity makes visible."
        eyebrow="TRUST THROUGH TRANSPARENCY"
        title="Know the limits before you rely on a tool."
      />
    </>
  );
}
