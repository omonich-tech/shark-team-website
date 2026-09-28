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

  const [content, faq, media] = await Promise.all([
    prisma.contentPage.findFirst({
      where: {
        slug: "home",
        status: ContentStatus.PUBLISHED
      }
    }),
    prisma.faqItem.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        branchId: "BR-SCHOOL-117-01",
        sportId: "SP-BASKETBALL-01"
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.mediaAsset.findMany({
      where: {
        AND: [
          publicMediaConsent,
          {
            OR: [
              {
                targetType: MediaTargetType.BRANCH,
                targetId: "BR-SCHOOL-117-01"
              },
              {
                targetType: MediaTargetType.COACH,
                targetId: "CO-0001"
              },
              {
                targetType: MediaTargetType.SPORT,
                targetId: "SP-BASKETBALL-01"
              }
            ]
          }
        ]
      },
      orderBy: [
        { isPrimary: "desc" },
        { sortOrder: "asc" },
        { createdAt: "asc" }
      ]
    })
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
