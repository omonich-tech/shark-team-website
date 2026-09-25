import "dotenv/config";
import {
  LeadStatus,
  TrialBookingStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import { hashCoachPassword } from "../src/server/coach/password";

const prisma = getPrisma();

async function main() {
  const coachId = "CO-0001";
  const username = process.env.COACH_SMOKE_USERNAME;
  const password = process.env.COACH_SMOKE_PASSWORD;

  if (!username || !password) {
    throw new Error("Coach smoke credentials are not configured");
  }

  const credentials = await hashCoachPassword(password);

  await prisma.coachAccount.upsert({
    where: { coachId },
    update: {
      username,
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
      isActive: true
    },
    create: {
      coachId,
      username,
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
      isActive: true
    }
  });

  const group = await prisma.trainingGroup.findUnique({
    where: { id: "GR-BASK-S117-0608-01" }
  });

  if (!group) throw new Error("Coach smoke group not found");

  const session = await prisma.trainingSession.findFirst({
    where: {
      groupId: group.id,
      startsAt: { gt: new Date() }
    },
    orderBy: { startsAt: "asc" }
  });

  if (!session) throw new Error("Coach smoke session not found");

  await prisma.trainingSession.update({
    where: { id: session.id },
    data: {
      trialCapacity: 1,
      trialBookingEnabled: true
    }
  });

  const regularParent = await prisma.parent.upsert({
    where: { phone: "+998901110001" },
    update: { name: "Regular Parent", locale: "ru" },
    create: {
      name: "Regular Parent",
      phone: "+998901110001",
      locale: "ru"
    }
  });

  let regularChild = await prisma.child.findFirst({
    where: {
      parentId: regularParent.id,
      name: "Regular Child"
    }
  });

  if (!regularChild) {
    regularChild = await prisma.child.create({
      data: {
        parentId: regularParent.id,
        name: "Regular Child",
        ageAtRegistration: 7
      }
    });
  }

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      childId: regularChild.id,
      groupId: group.id,
      status: "ACTIVE"
    }
  });

  if (!enrollment) {
    await prisma.studentEnrollment.create({
      data: {
        childId: regularChild.id,
        groupId: group.id,
        status: "ACTIVE",
        startDate: new Date("2026-09-01T00:00:00.000Z")
      }
    });
  }

  const trialParent = await prisma.parent.upsert({
    where: { phone: "+998901110002" },
    update: { name: "Coach Trial Parent", locale: "ru" },
    create: {
      name: "Coach Trial Parent",
      phone: "+998901110002",
      locale: "ru"
    }
  });

  let trialChild = await prisma.child.findFirst({
    where: {
      parentId: trialParent.id,
      name: "Coach Trial Child"
    }
  });

  if (!trialChild) {
    trialChild = await prisma.child.create({
      data: {
        parentId: trialParent.id,
        name: "Coach Trial Child",
        ageAtRegistration: 7
      }
    });
  }

  let lead = await prisma.lead.findFirst({
    where: {
      phone: trialParent.phone,
      selectedSessionId: session.id,
      childName: trialChild.name
    }
  });

  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        status: LeadStatus.TRIAL_CONFIRMED,
        parentName: trialParent.name,
        childName: trialChild.name,
        phone: trialParent.phone,
        childAge: 7,
        locale: "ru",
        source: "ci",
        branchId: group.branchId,
        sportId: group.sportId,
        groupId: group.id,
        selectedSessionId: session.id,
        parentId: trialParent.id,
        childId: trialChild.id,
        landingPage: "/ru/trial",
        utmSource: "ci",
        utmMedium: "coach",
        utmCampaign: "coach-dashboard"
      }
    });
  }

  await prisma.trialBooking.upsert({
    where: {
      leadId_sessionId: {
        leadId: lead.id,
        sessionId: session.id
      }
    },
    update: {
      status: TrialBookingStatus.CONFIRMED,
      expiresAt: new Date(session.startsAt.getTime() - 60 * 60 * 1000),
      confirmedAt: new Date()
    },
    create: {
      leadId: lead.id,
      sessionId: session.id,
      status: TrialBookingStatus.CONFIRMED,
      expiresAt: new Date(session.startsAt.getTime() - 60 * 60 * 1000),
      confirmedAt: new Date()
    }
  });

  console.log("Coach smoke data prepared.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
