import {
  ContentStatus,
  LifecycleStatus,
  MediaConsentStatus,
  MediaTargetType,
  PriceProductType,
  Weekday
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  PUBLIC_COACH_WHERE,
  PUBLIC_SPORT_WHERE
} from "@/server/public-data/visibility";
import {
  activePriceWhere,
  resolveEffectivePrice
} from "@/server/public-data/pricing";

const weekdayOrder: Record<Weekday, number> = {
  MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4,
  FRIDAY: 5, SATURDAY: 6, SUNDAY: 7
};

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export async function getBranchPublicData(slug: string) {
  const prisma = getPrisma();
  const now = new Date();

  const branch = await prisma.branch.findUnique({
    where: { slug },
    include: {
      sportLinks: {
        where: {
          status: LifecycleStatus.ACTIVE,
          sport: PUBLIC_SPORT_WHERE
        },
        include: { sport: true }
      },
      coachLinks: {
        where: {
          status: LifecycleStatus.ACTIVE,
          coach: PUBLIC_COACH_WHERE
        },
        include: { coach: true }
      },
      groups: {
        where: {
          status: LifecycleStatus.ACTIVE,
          enrollmentStatus: { not: "CLOSED" },
          sport: PUBLIC_SPORT_WHERE,
          primaryCoach: PUBLIC_COACH_WHERE
        },
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

  if (!branch || branch.status !== LifecycleStatus.ACTIVE) return null;

  const coachIds = Array.from(
    new Set([
      ...branch.coachLinks.map((link) => link.coachId),
      ...branch.groups.map((group) => group.primaryCoachId)
    ])
  );
  const sportIds = Array.from(
    new Set(branch.sportLinks.map((link) => link.sportId))
  );

  const [prices, media, faq] = await Promise.all([
    prisma.price.findMany({
      where: {
        ...activePriceWhere(now),
        OR: [
          { branchId: branch.id },
          {
            branchId: null,
            sportId: { in: sportIds.length ? sportIds : ["__none__"] }
          }
        ]
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
              { targetType: MediaTargetType.BRANCH, targetId: branch.id },
              {
                targetType: MediaTargetType.COACH,
                targetId: { in: coachIds.length ? coachIds : ["__none__"] }
              },
              {
                targetType: MediaTargetType.SPORT,
                targetId: { in: sportIds.length ? sportIds : ["__none__"] }
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
    }),
    prisma.faqItem.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        branchId: branch.id,
        sportId: null
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    })
  ]);

  return {
    id: branch.id,
    slug: branch.slug,
    name: { ru: branch.publicNameRu, uz: branch.publicNameUz },
    district: { ru: branch.districtRu, uz: branch.districtUz },
    address: {
      ru: branch.addressRu,
      uz: branch.addressUz,
      postalCode: branch.postalCode
    },
    landmark: { ru: branch.landmarkRu, uz: branch.landmarkUz },
    entranceNote: { ru: branch.entranceNoteRu, uz: branch.entranceNoteUz },
    publicPhone: branch.publicPhone,
    workingHours: {
      ru: branch.workingHoursRu,
      uz: branch.workingHoursUz
    },
    facilityNotes: {
      ru: branch.facilityNotesRu,
      uz: branch.facilityNotesUz
    },
    coordinates:
      branch.latitude !== null && branch.longitude !== null
        ? {
            latitude: Number(branch.latitude),
            longitude: Number(branch.longitude)
          }
        : null,
    sports: branch.sportLinks
      .filter(({ sport }) => sport.status === LifecycleStatus.ACTIVE)
      .map(({ sport }) => ({
        id: sport.id,
        slug: sport.slug,
        name: { ru: sport.nameRu, uz: sport.nameUz }
      })),
    coaches: branch.coachLinks.map(({ coach }) => ({
      id: coach.id,
      firstName: coach.firstName,
      lastName: coach.lastName,
      experienceYears: coach.experienceYears,
      bio: { ru: coach.publicBioRu, uz: coach.publicBioUz }
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
        name: { ru: group.sport.nameRu, uz: group.sport.nameUz }
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
      alt: { ru: item.altRu, uz: item.altUz }
    })),
    prices: {
      bySport: branch.sportLinks
        .filter(({ sport }) => sport.status === LifecycleStatus.ACTIVE)
        .map(({ sport }) => ({
          sport: {
            id: sport.id,
            slug: sport.slug,
            name: { ru: sport.nameRu, uz: sport.nameUz }
          },
          trial: resolveEffectivePrice(
            prices,
            PriceProductType.TRIAL,
            { sportId: sport.id, branchId: branch.id }
          ),
          subscription: resolveEffectivePrice(
            prices,
            PriceProductType.SUBSCRIPTION,
            { sportId: sport.id, branchId: branch.id }
          )
        }))
    },
    faq: faq.map((item) => ({
      id: item.id,
      question: { ru: item.questionRu, uz: item.questionUz },
      answer: { ru: item.answerRu, uz: item.answerUz }
    }))
  };
}

export type BranchPublicData = NonNullable<
  Awaited<ReturnType<typeof getBranchPublicData>>
>;

export async function tryGetBranchPublicData(slug: string) {
  try {
    return await getBranchPublicData(slug);
  } catch (error) {
    console.error("Public branch query failed", error);
    return null;
  }
}
