import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  EnrollmentStatus,
  LifecycleStatus,
  PriceProductType,
  PrismaClient,
  Weekday
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

const SPORT_ID = "SP-BASKETBALL-01";
const BRANCH_ID = "BR-SCHOOL-117-01";
const COACH_ID = "CO-0001";

const groups = [
  {
    id: "GR-BASK-S117-0608-01",
    internalName: "Basketball 6-8",
    ageMin: 6,
    ageMax: 8,
    startMinutes: 17 * 60,
    endMinutes: 18 * 60
  },
  {
    id: "GR-BASK-S117-0911-01",
    internalName: "Basketball 9-11",
    ageMin: 9,
    ageMax: 11,
    startMinutes: 18 * 60,
    endMinutes: 19 * 60
  },
  {
    id: "GR-BASK-S117-1215-01",
    internalName: "Basketball 12-15",
    ageMin: 12,
    ageMax: 15,
    startMinutes: 19 * 60,
    endMinutes: 20 * 60
  }
] as const;

const trainingDays = [
  Weekday.TUESDAY,
  Weekday.THURSDAY,
  Weekday.SATURDAY
] as const;

async function main() {
  await prisma.sport.upsert({
    where: { id: SPORT_ID },
    update: {
      status: LifecycleStatus.ACTIVE,
      nameRu: "Баскетбол",
      nameUz: "Basketbol",
      ageMin: 6,
      ageMax: 15,
      sortOrder: 1
    },
    create: {
      id: SPORT_ID,
      slug: "basketball",
      status: LifecycleStatus.ACTIVE,
      nameRu: "Баскетбол",
      nameUz: "Basketbol",
      ageMin: 6,
      ageMax: 15,
      sortOrder: 1
    }
  });

  await prisma.branch.upsert({
    where: { id: BRANCH_ID },
    update: {
      status: LifecycleStatus.ACTIVE,
      publicNameRu: "SHARK TEAM — Школа №117",
      publicNameUz: "SHARK TEAM — 117-maktab",
      districtRu: "Юнусабадский район",
      districtUz: "Yunusobod tumani",
      addressRu: "ул. Хитой, 9, Ташкент",
      addressUz: "Xitoy ko‘chasi, 9, Toshkent",
      postalCode: "100099",
      landmarkRu: "Метро «Шахристан»",
      landmarkUz: "«Shahriston» metro bekati",
      workingHoursRu: "Вт / Чт / Сб, 17:00–20:00",
      workingHoursUz: "Sesh / Pay / Shan, 17:00–20:00",
      facilityNotesRu: "Спортивный зал школы. Баскетбол.",
      facilityNotesUz: "Maktab sport zali. Basketbol."
    },
    create: {
      id: BRANCH_ID,
      slug: "school-117",
      status: LifecycleStatus.ACTIVE,
      internalName: "Школа №117",
      publicNameRu: "SHARK TEAM — Школа №117",
      publicNameUz: "SHARK TEAM — 117-maktab",
      districtRu: "Юнусабадский район",
      districtUz: "Yunusobod tumani",
      addressRu: "ул. Хитой, 9, Ташкент",
      addressUz: "Xitoy ko‘chasi, 9, Toshkent",
      postalCode: "100099",
      landmarkRu: "Метро «Шахристан»",
      landmarkUz: "«Shahriston» metro bekati",
      workingHoursRu: "Вт / Чт / Сб, 17:00–20:00",
      workingHoursUz: "Sesh / Pay / Shan, 17:00–20:00",
      facilityNotesRu: "Спортивный зал школы. Баскетбол.",
      facilityNotesUz: "Maktab sport zali. Basketbol."
    }
  });

  await prisma.coach.upsert({
    where: { id: COACH_ID },
    update: {
      status: LifecycleStatus.ACTIVE,
      firstName: "Дилшод"
    },
    create: {
      id: COACH_ID,
      status: LifecycleStatus.ACTIVE,
      firstName: "Дилшод"
    }
  });

  await prisma.branchSport.upsert({
    where: {
      branchId_sportId: {
        branchId: BRANCH_ID,
        sportId: SPORT_ID
      }
    },
    update: { status: LifecycleStatus.ACTIVE },
    create: {
      branchId: BRANCH_ID,
      sportId: SPORT_ID,
      status: LifecycleStatus.ACTIVE
    }
  });

  await prisma.coachSport.upsert({
    where: {
      coachId_sportId: {
        coachId: COACH_ID,
        sportId: SPORT_ID
      }
    },
    update: { status: LifecycleStatus.ACTIVE },
    create: {
      coachId: COACH_ID,
      sportId: SPORT_ID,
      status: LifecycleStatus.ACTIVE
    }
  });

  await prisma.coachBranch.upsert({
    where: {
      coachId_branchId: {
        coachId: COACH_ID,
        branchId: BRANCH_ID
      }
    },
    update: { status: LifecycleStatus.ACTIVE },
    create: {
      coachId: COACH_ID,
      branchId: BRANCH_ID,
      status: LifecycleStatus.ACTIVE
    }
  });

  for (const group of groups) {
    await prisma.trainingGroup.upsert({
      where: { id: group.id },
      update: {
        branchId: BRANCH_ID,
        sportId: SPORT_ID,
        primaryCoachId: COACH_ID,
        internalName: group.internalName,
        status: LifecycleStatus.ACTIVE,
        enrollmentStatus: EnrollmentStatus.OPEN,
        ageMin: group.ageMin,
        ageMax: group.ageMax,
        capacityRegular: 20
      },
      create: {
        id: group.id,
        branchId: BRANCH_ID,
        sportId: SPORT_ID,
        primaryCoachId: COACH_ID,
        internalName: group.internalName,
        status: LifecycleStatus.ACTIVE,
        enrollmentStatus: EnrollmentStatus.OPEN,
        ageMin: group.ageMin,
        ageMax: group.ageMax,
        capacityRegular: 20,
        capacityTrial: null
      }
    });

    for (const weekday of trainingDays) {
      const ruleId = `RULE-${group.id}-${weekday}`;

      await prisma.groupScheduleRule.upsert({
        where: { id: ruleId },
        update: {
          weekday,
          startMinutes: group.startMinutes,
          endMinutes: group.endMinutes,
          status: LifecycleStatus.ACTIVE
        },
        create: {
          id: ruleId,
          groupId: group.id,
          weekday,
          startMinutes: group.startMinutes,
          endMinutes: group.endMinutes,
          status: LifecycleStatus.ACTIVE
        }
      });
    }
  }

  await prisma.price.upsert({
    where: { id: "PRICE-BASK-S117-TRIAL-01" },
    update: {
      amount: 50000,
      currency: "UZS",
      status: LifecycleStatus.ACTIVE
    },
    create: {
      id: "PRICE-BASK-S117-TRIAL-01",
      productType: PriceProductType.TRIAL,
      amount: 50000,
      currency: "UZS",
      sportId: SPORT_ID,
      branchId: BRANCH_ID,
      status: LifecycleStatus.ACTIVE
    }
  });

  await prisma.price.upsert({
    where: { id: "PRICE-BASK-S117-SUBSCRIPTION-01" },
    update: {
      amount: 500000,
      currency: "UZS",
      status: LifecycleStatus.ACTIVE
    },
    create: {
      id: "PRICE-BASK-S117-SUBSCRIPTION-01",
      productType: PriceProductType.SUBSCRIPTION,
      amount: 500000,
      currency: "UZS",
      sportId: SPORT_ID,
      branchId: BRANCH_ID,
      status: LifecycleStatus.ACTIVE
    }
  });

  console.log("Seeded SHARK TEAM School 117 core data.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
