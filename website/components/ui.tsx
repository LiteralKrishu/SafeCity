import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";
import { Reveal } from "./reveal";
import { DOWNLOAD_URL } from "./site-links";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="eyebrow">
      <span />
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  copy,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  copy?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <Reveal className={`section-heading align-${align}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2>{title}</h2>
      {copy && <p>{copy}</p>}
    </Reveal>
  );
}

export function PageHero({
  eyebrow,
  title,
  copy,
  children,
  visual,
  className = "",
}: {
  eyebrow: string;
  title: ReactNode;
  copy: ReactNode;
  children?: ReactNode;
  visual?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`page-hero ${visual ? "page-hero-rich" : ""} ${className}`.trim()}
    >
      <div className="page-hero-grid" />
      <div
        className={`container page-hero-inner ${visual ? "page-hero-rich-grid" : ""}`.trim()}
      >
        <Reveal className="page-hero-content">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1>{title}</h1>
          <p className="page-hero-copy">{copy}</p>
          {children}
        </Reveal>
        {visual && (
          <Reveal className="page-hero-visual" delay={120}>
            {visual}
          </Reveal>
        )}
      </div>
      <div className="page-hero-orb" />
    </section>
  );
}

export function CTA({
  eyebrow = "READY WHEN YOU ARE",
  title = "Put your safety back in your hands.",
  copy = "Explore the prototype, understand its limits, and set up protection on your terms.",
}: {
  eyebrow?: string;
  title?: string;
  copy?: string;
}) {
  return (
    <section className="cta-section">
      <div className="container">
        <Reveal className="cta-panel">
          <div className="cta-grid" />
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2>{title}</h2>
          <p>{copy}</p>
          <div className="button-row">
            <a className="button button-light" href={DOWNLOAD_URL}>
              Download APK
              <Icon name="arrow" />
            </a>
            <Link className="button button-ghost-light" href="/safety">
              Read safety notes
            </Link>
          </div>
          <div className="cta-shield">
            <Icon name="shield" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function LegalPage({
  label,
  title,
  version,
  effective,
  introduction,
  sections,
}: {
  label: string;
  title: string;
  version: string;
  effective: string;
  introduction: ReactNode;
  sections: Array<{
    title: string;
    content: ReactNode;
  }>;
}) {
  return (
    <>
      <PageHero eyebrow={label} title={title} copy={introduction}>
        <div className="legal-meta">
          <span>Version {version}</span>
          <span>Effective {effective}</span>
          <span>Pre-release template</span>
        </div>
      </PageHero>
      <section className="legal-layout section">
        <div className="container legal-grid">
          <aside className="legal-index">
            <p>On this page</p>
            <nav aria-label={`${title} sections`}>
              {sections.map((section, index) => (
                <a href={`#section-${index + 1}`} key={section.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>
          <article className="legal-content">
            <div className="legal-warning">
              <Icon name="spark" />
              <div>
                <strong>Important pre-release notice</strong>
                <p>
                  Operator identity, grievance contact, final app behavior, and
                  qualified Indian legal review must be completed before public
                  distribution.
                </p>
              </div>
            </div>
            {sections.map((section, index) => (
              <Reveal
                className="legal-section"
                id={`section-${index + 1}`}
                key={section.title}
              >
                <p className="legal-number">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2>{section.title}</h2>
                <div className="legal-body">{section.content}</div>
              </Reveal>
            ))}
          </article>
        </div>
      </section>
    </>
  );
}
