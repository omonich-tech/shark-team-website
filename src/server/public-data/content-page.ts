import {
  ContentStatus,
  MediaConsentStatus,
  MediaTargetType
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

export async function getPublishedContentPage(slug: string) {
  const prisma = getPrisma();

  const content = await prisma.contentPage.findFirst({
    where: {
      slug,
      status: ContentStatus.PUBLISHED
    }
  });

  if (!content) return null;

  const media = await prisma.mediaAsset.findMany({
    where: {
      targetType: MediaTargetType.PAGE,
      targetId: content.id,
      OR: [
        { containsMinors: false },
        {
          containsMinors: true,
          consentStatus: MediaConsentStatus.APPROVED
        }
      ]
    },
    orderBy: [
      { isPrimary: "desc" },
      { sortOrder: "asc" },
      { createdAt: "asc" }
    ]
  });

  return { content, media };
}

export async function tryGetPublishedContentPage(slug: string) {
  try {
    return await getPublishedContentPage(slug);
  } catch (error) {
    console.error(`Public content page query failed: ${slug}`, error);
    return null;
  }
}
