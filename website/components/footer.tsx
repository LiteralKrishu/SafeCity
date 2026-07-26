import Link from "next/link";
import { Brand } from "./brand";
import { Icon } from "./icons";
import { STACKOVERHACK_LINKS } from "./site-links";

const groups = [
  {
    label: "Product",
    links: [
      ["/features", "Features"],
      ["/how-it-works", "How it works"],
      ["/safety", "Safety & trust"],
      ["/download", "Get the app"],
      ["/feedback", "Share feedback"],
    ],
  },
  {
    label: "Your privacy",
    links: [
      ["/data-rights", "Data rights"],
      ["/privacy", "Privacy notice"],
      ["/terms", "Terms & conditions"],
    ],
  },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-glow" />
      <div className="container footer-grid">
        <div className="footer-lead">
          <Brand />
          <p>
            Personal safety intelligence that stays close: on your phone and
            under your control.
          </p>
          <span className="prototype-badge">
            <span />
            Pre-release safety prototype
          </span>
          <div className="footer-maker">
            <p>
              An app by <Link href="/credits">StackOverHack</Link>
            </p>
            <div className="footer-socials" aria-label="StackOverHack profiles">
              <a
                href={STACKOVERHACK_LINKS.company}
                rel="noreferrer"
                target="_blank"
              >
                Company
              </a>
              <a
                href={STACKOVERHACK_LINKS.linkedin}
                rel="noreferrer"
                target="_blank"
              >
                LinkedIn
              </a>
              <a
                href={STACKOVERHACK_LINKS.instagram}
                rel="noreferrer"
                target="_blank"
              >
                Instagram
              </a>
              <a
                href={STACKOVERHACK_LINKS.x}
                rel="noreferrer"
                target="_blank"
              >
                X
              </a>
            </div>
          </div>
        </div>
        {groups.map((group) => (
          <div className="footer-group" key={group.label}>
            <p>{group.label}</p>
            {group.links.map(([href, label]) => (
              <Link href={href} key={href}>
                {label}
              </Link>
            ))}
          </div>
        ))}
        <div className="footer-action">
          <p>Protection, explained clearly.</p>
          <Link href="/safety">
            Read our safety principles
            <Icon name="arrow" />
          </Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <p>
          © {new Date().getFullYear()} SafeCity · An app by{" "}
          <Link href="/credits">StackOverHack</Link>
        </p>
        <p>
          SafeCity cannot guarantee detection, delivery, emergency response, or
          personal safety.
        </p>
      </div>
    </footer>
  );
}
