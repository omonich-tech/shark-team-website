import {
  LifecycleStatus,
  MediaConsentStatus,
  MediaTargetType,
  PriceProductType,
  Weekday
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

const weekdayOrder: Record<Weekday, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7
};

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export async function getSchool117PublicData() {
  const prisma = getPrisma();
  const now = new Date();

  const branch = await prisma.branch.findUnique({
    where: { slug: "school-117" },
    include: {
      sportLinks: {
        where: { status: LifecycleStatus.ACTIVE },
        include: { sport: true }
      },
      groups: {
        where: { status: LifecycleStatus.ACTIVE },
        orderBy: { ageMin: "asc" },
        include: {
          sport: true,
          primaryCoach: true,
          scheduleRules: {
            where: { status: LifecycleStatus.ACTIVE }
          }
        }
      }
    }
  });

  if (!branch || branch.status !== LifecycleStatus.ACTIVE) {
    return null;
  }

  const [prices, media] = await Promise.all([
    prisma.price.findMany({
      where: {
        branchId: branch.id,
        status: LifecycleStatus.ACTIVE,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }]
      },
      orderBy: [{ productType: "asc" }, { validFrom: "desc" }]
    }),
    prisma.mediaAsset.findMany({
      where: {
        AND: [
          {
            OR: [
              { containsMinors: false },
              {
                containsMinors: true,
                consentStatus: MediaConsentStatus.APPROVED
              }
            ]
          },
          {
            OR: [
              {
                targetType: MediaTargetType.BRANCH,
                targetId: branch.id
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
    id: branch.id,
    slug: branch.slug,
    name: {
      ru: branch.publicNameRu,
      uz: branch.publicNameUz
    },
    district: {
      ru: branch.districtRu,
      uz: branch.districtUz
    },
    address: {
      ru: branch.addressRu,
      uz: branch.addressUz,
      postalCode: branch.postalCode
    },
    landmark: {
      ru: branch.landmarkRu,
      uz: branch.landmarkUz
    },
    sports: branch.sportLinks.map(({ sport }) => ({
      id: sport.id,
      slug: sport.slug,
      name: {
        ru: sport.nameRu,
        uz: sport.nameUz
      }
    })),
    groups: branch.groups.map((group) => ({
      id: group.id,
      ageMin: group.ageMin,
      ageMax: group.ageMax,
      capacityRegular: group.capacityRegular,
      capacityTrial: group.capacityTrial,
      enrollmentStatus: group.enrollmentStatus,
      sport: {
        id: group.sport.id,
        slug: group.sport.slug,
        name: {
          ru: group.sport.nameRu,
          uz: group.sport.nameUz
        }
      },
      coach: {
        id: group.primaryCoach.id,
        firstName: group.primaryCoach.firstName,
        lastName: group.primaryCoach.lastName
      },
      schedule: group.scheduleRules
        .map((rule) => ({
          weekday: rule.weekday,
          start: formatMinutes(rule.startMinutes),
          end: formatMinutes(rule.endMinutes)
        }))
        .sort((a, b) => weekdayOrder[a.weekday] - weekdayOrder[b.weekday])
    })),
    media: media.map((item) => ({
      id: item.id,
      targetType: item.targetType,
      targetId: item.targetId,
      category: item.category,
      url: item.url,
      contentType: item.contentType,
      isPrimary: item.isPrimary,
      alt: {
        ru: item.altRu,
        uz: item.altUz
      }
    })),
    prices: {
      trial:
        prices.find((price) => price.productType === PriceProductType.TRIAL) ?? null,
      subscription:
        prices.find(
          (price) => price.productType === PriceProductType.SUBSCRIPTION
        ) ?? null
    }
  };
}

export type School117PublicData = NonNullable<
  Awaited<ReturnType<typeof getSchool117PublicData>>
>;

export async function tryGetSchool117PublicData() {
  try {
    return await getSchool117PublicData();
  } catch (error) {
    console.error("Public database query failed", error);
    return null;
  }
}
