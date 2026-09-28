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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const now = new Date();
  const prisma = getPrisma();

  const branches = await prisma.branch.findMany({
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
  });

  const staticPaths = [
    "",
    "/basketball",
    "/branches",
    "/schedule",
    "/prices",
    "/coaches"
  ];

  const result: MetadataRoute.Sitemap = [];

  for (const locale of ["ru", "uz"] as const) {
    for (const path of staticPaths) {
      result.push({
        url: `${base}/${locale}${path}`,
        lastModified: now,
        changeFrequency: path === "" ? "weekly" : "monthly",
        priority: path === "" ? 1 : path === "/branches" ? 0.9 : 0.7
      });
    }

    for (const branch of branches) {
      result.push({
        url: `${base}/${locale}/branches/${branch.slug}`,
        lastModified: branch.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8
      });
    }
  }

  return result;
}
