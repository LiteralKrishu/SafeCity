import type { Metadata } from "next";
import Image from "next/image";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { STACKOVERHACK_LINKS } from "@/components/site-links";
import { Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Credits & team",
  description:
    "Meet StackOverHack and the multidisciplinary team building SafeCity.",
};

const team = [
  {
    name: "Sousnigdho Das",
    role: "Backend & Full-stack",
    note: "Team lead",
    image: "/team/sousnigdho.webp",
    imagePosition: "50% 38%",
    href: "https://www.linkedin.com/in/sousnigdho-das?utm_source=share_via&utm_content=profile&utm_medium=member_android",
  },
  {
    name: "Ayushi",
    role: "Marketing",
    note: "Outreach & communication",
    image: "/team/ayushi.webp",
    imagePosition: "50% 32%",
    href: "https://www.linkedin.com/in/ayushi-sinha-2493793aa?utm_source=share_via&utm_content=profile&utm_medium=member_android",
  },
  {
    name: "Sapna Talke",
    role: "DevOps & Designer",
    note: "Systems & visual design",
    image: "/team/sapna.webp",
    imagePosition: "63% 42%",
    href: "https://www.linkedin.com/in/sapna-talke-6a1ba9378?utm_source=share_via&utm_content=profile&utm_medium=member_android",
  },
  {
    name: "Khushvindar Singh",
    role: "Frontend",
    note: "Web experience",
    image: "/team/khushvindar.webp",
    imagePosition: "50% 48%",
    href: "https://www.linkedin.com/in/khushvindar-singh-87015a2b1?utm_source=share_via&utm_content=profile&utm_medium=member_android",
  },
  {
    name: "Shyamli Bakale",
    role: "UI/UX Design",
    note: "Product experience",
    image: "/team/shyamli.webp",
    imagePosition: "50% 38%",
    href: "https://www.linkedin.com/in/shyamlibakale?utm_source=share_via&utm_content=profile&utm_medium=member_android",
  },
  {
    name: "Surya Pratap Singh Rathod",
    role: "Domain Researcher",
    note: "Safety domain research",
    image: "/team/surya.webp",
    imagePosition: "50% 36%",
    href: "https://www.linkedin.com/in/surya-pratap-singh-rathore-62a040417?utm_source=share_via&utm_content=profile&utm_medium=member_android",
  },
] as const;

const profiles = [
  {
    label: "Company",
    title: "StackOverHack on LinkedIn",
    copy: "Follow the company page for product and team updates.",
    href: STACKOVERHACK_LINKS.company,
    number: "01",
  },
  {
    label: "Profile",
    title: "StackOverHack network",
    copy: "Connect with the team and follow what we are building.",
    href: STACKOVERHACK_LINKS.linkedin,
    number: "02",
  },
  {
    label: "Social",
    title: "StackOverHack on Instagram",
    copy: "See product stories, visuals, and updates from the team.",
    href: STACKOVERHACK_LINKS.instagram,
    number: "03",
  },
  {
    label: "Updates",
    title: "StackOverHack on X",
    copy: "Follow short updates, launches, and conversations from the team.",
    href: STACKOVERHACK_LINKS.x,
    number: "04",
  },
] as const;

export default function CreditsPage() {
  return (
    <>
      <section className="credits-team">
        <div className="credits-hero-orb" />
        <div className="container">
          <div className="credits-hero-heading">
            <Reveal>
              <Eyebrow>THE MAIN TEAM · STACKOVERHACK</Eyebrow>
              <h1>
                Meet the people <em>building SafeCity.</em>
              </h1>
            </Reveal>
            <Reveal className="credits-hero-intro" delay={90}>
              <p>
                Six contributors across engineering, design, research,
                operations, and communication—working together on thoughtful
                personal safety technology.
              </p>
              <div className="credits-team-count">
                <strong>06</strong>
                <span>Core contributors</span>
              </div>
            </Reveal>
          </div>
          <div className="team-grid">
            {team.map((member, index) => (
              <Reveal
                className="team-card"
                delay={(index % 3) * 70}
                key={member.name}
              >
                <div className="team-photo" style={{ position: "relative" }}>
                  <Image
                    alt={`${member.name}, ${member.role} at SafeCity`}
                    fill
                    priority={index < 3}
                    sizes="(max-width: 580px) 132px, (max-width: 1050px) 50vw, 33vw"
                    src={member.image}
                    style={{ objectPosition: member.imagePosition }}
                  />
                  <div className="team-photo-wash" />
                  <span className="team-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="team-card-content">
                  <p>{member.role}</p>
                  <h2>{member.name}</h2>
                  <span className="team-note">{member.note}</span>
                  <a href={member.href} rel="noreferrer" target="_blank">
                    LinkedIn profile
                    <Icon name="arrow" />
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section credits-studio">
        <div className="container credits-studio-grid">
          <Reveal className="credits-studio-copy">
            <Eyebrow>APP BY STACKOVERHACK</Eyebrow>
            <h2>Follow what we&apos;re building.</h2>
            <p>
              SafeCity is shaped by a multidisciplinary StackOverHack team.
              Connect with us for product updates, visual stories, and the work
              behind each release.
            </p>
            <a
              className="button button-small"
              href={STACKOVERHACK_LINKS.company}
              rel="noreferrer"
              target="_blank"
            >
              Visit StackOverHack
              <Icon name="arrow" />
            </a>
          </Reveal>
          <div className="credits-profile-grid">
            {profiles.map((profile, index) => (
              <Reveal
                className="credits-profile-card"
                delay={(index % 2) * 70}
                key={profile.href}
              >
                <div className="credits-profile-top">
                  <span>{profile.number}</span>
                  <small>{profile.label}</small>
                </div>
                <h3>{profile.title}</h3>
                <p>{profile.copy}</p>
                <a href={profile.href} rel="noreferrer" target="_blank">
                  Open profile
                  <Icon name="arrow" />
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
