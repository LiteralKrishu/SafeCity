"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "./brand";
import { Icon } from "./icons";

const links = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/safety", label: "Safety & trust" },
  { href: "/data-rights", label: "Your data" },
  { href: "/credits", label: "Team" },
  { href: "/feedback", label: "Feedback" },
];

export function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="site-header">
      <nav className="nav-shell" aria-label="Main navigation">
        <Brand />
        <div className="nav-links">
          {links.map((link) => (
            <Link
              className={pathname === link.href ? "is-active" : ""}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <Link className="button button-small nav-cta" href="/download">
          Download APK
          <Icon name="arrow" />
        </Link>
        <button
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className={`menu-button ${open ? "is-open" : ""}`}
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <span />
          <span />
        </button>
      </nav>
      <div className={`mobile-nav ${open ? "is-open" : ""}`}>
        {links.map((link) => (
          <Link href={link.href} key={link.href}>
            {link.label}
            <Icon name="arrow" />
          </Link>
        ))}
        <Link className="button" href="/download">
          Download APK
        </Link>
      </div>
    </header>
  );
}
