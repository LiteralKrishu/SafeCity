import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/features",
    "/feedback",
    "/credits",
    "/how-it-works",
    "/safety",
    "/download",
    "/privacy",
    "/terms",
    "/data-rights",
  ];

  return routes.map((route) => ({
    url: `https://safecity.local${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}
