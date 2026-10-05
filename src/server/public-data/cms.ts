import {
  ContentStatus,
  MediaConsentStatus,
  MediaTargetType
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

const publicMediaConsent = {
  OR: [
    { containsMinors: false },
    {
      containsMinors: true,
      consentStatus: MediaConsentStatus.APPROVED
    }
  ]
};

export async function getPublishedHomeCms() {
  const prisma = getPrisma();

  const content = await prisma.contentPage.findFirst({
    where: {
      slug: "home",
      status: ContentStatus.PUBLISHED
    }
  });

  const [faq, media] = await Promise.all([
    prisma.faqItem.findMany({
      where: {
        status: ContentStatus.PUBLISHED
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    content
      ? prisma.mediaAsset.findMany({
          where: {
            AND: [
              publicMediaConsent,
              {
                targetType: MediaTargetType.PAGE,
                targetId: content.id
              }
            ]
          },
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
            { createdAt: "asc" }
          ]
        })
      : Promise.resolve([])
  ]);

  return {
    content,
    faq,
    media
  };
}

export async function tryGetPublishedHomeCms() {
  try {
    return await getPublishedHomeCms();
  } catch (error) {
    console.error("Public CMS query failed", error);
    return {
      content: null,
      faq: [],
      media: []
    };
  }
}
