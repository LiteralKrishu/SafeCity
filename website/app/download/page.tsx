import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DownloadQrCode } from "@/components/download-qr";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { DOWNLOAD_URL } from "@/components/site-links";
import { Eyebrow, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Get the app",
  description:
    "SafeCity pre-release app availability, setup, permission requirements, and platform coverage.",
};

export default function DownloadPage() {
  return (
    <>
      <section className="section download-stage">
        <div className="container download-stage-grid">
          <Reveal className="download-phone-scene">
            <div className="download-phone-halo" />
            <div className="product-phone download-phone">
              <Image
                alt="SafeCity protection health dashboard on a mobile device"
                fill
                priority
                sizes="(max-width: 860px) 72vw, 380px"
                src="/product/protection-health.png"
              />
            </div>
            <div className="download-chip chip-private"><Icon name="lock" />On-device AI</div>
            <div className="download-chip chip-control"><Icon name="check" />Cancelable SOS</div>
          </Reveal>
          <Reveal className="download-copy" delay={100}>
            <Eyebrow>CURRENT AVAILABILITY</Eyebrow>
            <h2>Native mobile, with an Android-first protection path.</h2>
            <p>
              SafeCity uses native inference, encrypted storage, background
              services, camera, motion, and audio capabilities.
            </p>
            <div className="download-qr-card">
              <a
                aria-label="Open the SafeCity APK download"
                className="download-qr-shell"
                href={DOWNLOAD_URL}
              >
                <DownloadQrCode />
              </a>
              <div className="download-qr-copy">
                <span>SCAN TO DOWNLOAD</span>
                <h3>Open the latest Android build.</h3>
                <p>
                  Scan with your phone camera or use the button to continue to
                  the current BuildShare release.
                </p>
                <a className="button button-small" href={DOWNLOAD_URL}>
                  Download APK
                  <Icon name="arrow" />
                </a>
              </div>
            </div>
            <div className="availability-card">
              <div>
                <span className="availability-icon"><Icon name="device" /></span>
                <p><small>ANDROID</small>Preview APK builds</p>
              </div>
              <b>Primary test target</b>
            </div>
            <div className="availability-card availability-card-muted">
              <div>
                <span className="availability-icon"><Icon name="device" /></span>
                <p><small>iOS</small>Local native builds</p>
              </div>
              <b>Foreground monitoring only</b>
            </div>
            <p className="availability-note">
              Public distribution, operator legal details, field validation,
              store disclosures, and production signing remain release work.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="section setup-section">
        <div className="container">
          <SectionHeading
            align="center"
            copy="The current prototype asks you to review sensors, add someone you trust, and affirm consent before monitoring begins."
            eyebrow="SETUP IN THREE MOMENTS"
            title={<>Know what you&apos;re enabling <em>before you start.</em></>}
          />
          <div className="setup-grid">
            {[
              ["01", "Review protection access", "See why microphone, motion, location, camera, notifications, and background access are requested.", "device"],
              ["02", "Choose an emergency contact", "Add someone who should be ready to help. Inform them that the app may prepare an SOS message.", "message"],
              ["03", "Confirm notice and consent", "Read the Privacy Notice and Terms, then choose whether to begin monitoring.", "check"],
            ].map(([number, title, copy, icon], index) => (
              <Reveal className="setup-card" delay={index * 75} key={number}>
                <span className="setup-number">{number}</span>
                <i><Icon name={icon as "device" | "message" | "check"} /></i>
                <h3>{title}</h3>
                <p>{copy}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section permission-section">
        <div className="container permission-grid">
          <Reveal className="permission-copy">
            <Eyebrow>PERMISSIONS, IN PLAIN LANGUAGE</Eyebrow>
            <h2>Every sensor should have a reason.</h2>
            <p>
              The intended production experience will separate optional
              purposes and degrade gracefully. The current all-permission
              onboarding gate is a known pre-release blocker.
            </p>
            <Link className="text-link" href="/privacy">
              Read the itemised data notice
              <Icon name="arrow" />
            </Link>
          </Reveal>
          <div className="permission-list">
            {[
              ["Microphone", "Short-lived distress audio and optional local voice triggers", "audio"],
              ["Motion", "Acceleration, jerk, rotation, free-fall, and impact features", "motion"],
              ["Location", "Incident coordinates, navigator, and optional coarse routine context", "map"],
              ["Camera", "Front and rear evidence after confirmed SOS while visible", "device"],
              ["Notifications", "Background status, local alerts, and handoff into protected capture", "message"],
            ].map(([title, copy, icon], index) => (
              <Reveal className="permission-row" delay={index * 45} key={title}>
                <span><Icon name={icon as "audio" | "motion" | "map" | "device" | "message"} /></span>
                <div><strong>{title}</strong><p>{copy}</p></div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section download-final">
        <div className="container">
          <Reveal className="cta-panel">
            <div className="cta-grid" />
            <Eyebrow>BEFORE YOU INSTALL</Eyebrow>
            <h2>Safety tools work best with a backup plan.</h2>
            <p>
              Keep emergency numbers, trusted contacts, and another way to ask
              for help. SafeCity can assist; it cannot replace them.
            </p>
            <div className="button-row">
              <Link className="button button-light" href="/safety">
                Review safety limits
                <Icon name="arrow" />
              </Link>
              <Link className="button button-ghost-light" href="/terms">
                Read terms
              </Link>
            </div>
            <div className="cta-shield"><Icon name="shield" /></div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
