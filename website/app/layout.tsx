import type { Metadata, Viewport } from "next";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://safecity.local"),
  title: {
    default: "SafeCity — Personal safety, private by design",
    template: "%s — SafeCity",
  },
  description:
    "SafeCity is a privacy-first personal safety app with on-device audio and motion intelligence, encrypted incident evidence, safety navigation, and user-controlled SOS tools.",
  applicationName: "SafeCity",
  keywords: [
    "personal safety app",
    "on-device AI",
    "SOS app",
    "safety navigator",
    "privacy-first safety",
  ],
  icons: {
    icon: "/safecity-logo.png",
    apple: "/safecity-logo.png",
  },
  openGraph: {
    title: "SafeCity — Safety intelligence that stays with you",
    description:
      "On-device protection, encrypted evidence, and safety tools under your control.",
    siteName: "SafeCity",
    type: "website",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#050a12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Navigation />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
