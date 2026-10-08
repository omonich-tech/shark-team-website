import type { MetadataRoute } from "next";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

function localizedUrl(locale: "ru" | "uz", path: string) {
  return `${appUrl()}/${locale}${path}`;
}

function alternates(path: string) {
  return {
    languages: {
      ru: localizedUrl("ru", path),
      uz: localizedUrl("uz", path)
    }
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const prisma = getPrisma();

  const [branches, sports, coaches] = await Promise.all([
    prisma.branch.findMany({
      where: {
        status: LifecycleStatus.ACTIVE,
        groups: {
          some: {
            status: LifecycleStatus.ACTIVE
          }
        }
      },
      select: {
        slug: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: "asc"
      }
    }),
    prisma.sport.findMany({
      where: {
        status: LifecycleStatus.ACTIVE
      },
      select: {
        slug: true,
        updatedAt: true
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.coach.findMany({
      where: {
        status: LifecycleStatus.ACTIVE
      },
      select: {
        id: true,
        updatedAt: true
      },
      orderBy: { createdAt: "asc" }
    })
  ]);

  const staticPaths: Array<{
    path: string;
    changeFrequency: "daily" | "weekly" | "monthly";
    priority: number;
  }> = [
    { path: "", changeFrequency: "weekly", priority: 1 },
    { path: "/sports", changeFrequency: "weekly", priority: 0.95 },
    { path: "/branches", changeFrequency: "weekly", priority: 0.9 },
    { path: "/schedule", changeFrequency: "daily", priority: 0.8 },
    { path: "/prices", changeFrequency: "weekly", priority: 0.8 },
    { path: "/coaches", changeFrequency: "monthly", priority: 0.75 },
    { path: "/about", changeFrequency: "monthly", priority: 0.65 },
    { path: "/contacts", changeFrequency: "monthly", priority: 0.65 }
  ];

  const result: MetadataRoute.Sitemap = [];

  for (const locale of ["ru", "uz"] as const) {
    for (const item of staticPaths) {
      result.push({
        url: localizedUrl(locale, item.path),
        lastModified: now,
        changeFrequency: item.changeFrequency,
        priority: item.priority,
        alternates: alternates(item.path)
      });
    }

    for (const sport of sports) {
      const path = `/sports/${sport.slug}`;
      result.push({
        url: localizedUrl(locale, path),
        lastModified: sport.updatedAt,
        changeFrequency: "weekly",
        priority: 0.85,
        alternates: alternates(path)
      });
    }

    for (const branch of branches) {
      const path = `/branches/${branch.slug}`;
      result.push({
        url: localizedUrl(locale, path),
        lastModified: branch.updatedAt,
        changeFrequency: "weekly",
        priority: 0.85,
        alternates: alternates(path)
      });
    }

    for (const coach of coaches) {
      const path = `/coaches/${coach.id}`;
      result.push({
        url: localizedUrl(locale, path),
        lastModified: coach.updatedAt,
        changeFrequency: "monthly",
        priority: 0.65,
        alternates: alternates(path)
      });
    }
  }

  return result;
}
