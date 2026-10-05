import {
  LifecycleStatus,
  MediaConsentStatus,
  MediaTargetType
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

const consentSafe = {
  OR: [
    { containsMinors: false },
    {
      containsMinors: true,
      consentStatus: MediaConsentStatus.APPROVED
    }
  ]
};

export async function getPublicHomeData() {
  const prisma = getPrisma();

  const [sports, branches, coaches] = await Promise.all([
    prisma.sport.findMany({
      where: { status: LifecycleStatus.ACTIVE },
      include: {
        groups: {
          where: { status: LifecycleStatus.ACTIVE },
          select: { id: true }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.branch.findMany({
      where: {
        status: LifecycleStatus.ACTIVE,
        groups: { some: { status: LifecycleStatus.ACTIVE } }
      },
      include: {
        groups: {
          where: { status: LifecycleStatus.ACTIVE },
          include: { sport: true }
        }
      },
      orderBy: { createdAt: "asc" },
      take: 6
    }),
    prisma.coach.findMany({
      where: { status: LifecycleStatus.ACTIVE },
      include: {
        sportLinks: {
          where: { status: LifecycleStatus.ACTIVE },
          include: { sport: true }
        },
        branchLinks: {
          where: { status: LifecycleStatus.ACTIVE },
          include: { branch: true }
        }
      },
      orderBy: { createdAt: "asc" },
      take: 8
    })
  ]);

  const targetIds = [
    ...sports.map((item) => item.id),
    ...branches.map((item) => item.id),
    ...coaches.map((item) => item.id)
  ];

  const media =
    targetIds.length === 0
      ? []
      : await prisma.mediaAsset.findMany({
          where: {
            AND: [
              consentSafe,
              {
                OR: [
                  {
                    targetType: MediaTargetType.SPORT,
                    targetId: { in: sports.map((item) => item.id) }
                  },
                  {
                    targetType: MediaTargetType.BRANCH,
                    targetId: { in: branches.map((item) => item.id) }
                  },
                  {
                    targetType: MediaTargetType.COACH,
                    targetId: { in: coaches.map((item) => item.id) }
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
        });

  return { sports, branches, coaches, media };
}

export async function tryGetPublicHomeData() {
  try {
    return await getPublicHomeData();
  } catch (error) {
    console.error("Public home data query failed", error);
    return null;
  }
}
