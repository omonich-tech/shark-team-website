import "dotenv/config";
import {
  AttendanceStatus,
  LeadStatus,
  SessionStatus,
  StudentEnrollmentStatus,
  SubscriptionStatus,
  TrialBookingStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import {
  getAdminSessionDetail,
  getAdminSessions
} from "../src/server/sessions/admin-session-overview";

const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const baseGroup = await prisma.trainingGroup.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" }
  });

  assert(baseGroup, "Base group for admin sessions smoke not found");

  const group = await prisma.trainingGroup.create({
    data: {
      id: "CI-ADMIN-SESSIONS-" + Date.now(),
      branchId: baseGroup.branchId,
      sportId: baseGroup.sportId,
      primaryCoachId: baseGroup.primaryCoachId,
      internalName: "CI Admin Sessions",
      status: baseGroup.status,
      enrollmentStatus: baseGroup.enrollmentStatus,
      ageMin: 8,
      ageMax: 14,
      capacityRegular: 10,
      capacityTrial: 2,
      startDate: new Date("2026-09-01T00:00:00.000Z")
    }
  });

  const regularParent = await prisma.parent.create({
    data: {
      name: "CI Sessions Regular Parent",
      phone: "+998900077040",
      locale: "ru"
    }
  });
  const regularChild = await prisma.child.create({
    data: {
      parentId: regularParent.id,
      name: "CI Sessions Regular Child",
      ageAtRegistration: 10
    }
  });

  await prisma.studentEnrollment.create({
    data: {
      childId: regularChild.id,
      groupId: group.id,
      status: StudentEnrollmentStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      currentPeriodStart: new Date("2026-09-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-11-01T00:00:00.000Z"),
      nextPaymentDueAt: new Date("2026-11-01T00:00:00.000Z")
    }
  });

  const trialParent = await prisma.parent.create({
    data: {
      name: "CI Sessions Trial Parent",
      phone: "+998900077041",
      locale: "ru"
    }
  });
  const trialChild = await prisma.child.create({
    data: {
      parentId: trialParent.id,
      name: "CI Sessions Trial Child",
      ageAtRegistration: 11
    }
  });

  const referenceNow = new Date("2026-10-02T09:30:00.000Z");
  const todayStart = new Date("2026-10-01T19:00:00.000Z");
  const tomorrowStart = new Date("2026-10-02T19:00:00.000Z");

  async function createSession(
    label: string,
    startsAt: string,
    endsAt: string,
    status: SessionStatus,
    completedAt?: string
  ) {
    return prisma.trainingSession.create({
      data: {
        groupId: group.id,
        coachId: group.primaryCoachId,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        status,
        completedAt: completedAt ? new Date(completedAt) : null,
        regularCapacity: group.capacityRegular,
        trialCapacity: group.capacityTrial,
        trialBookingEnabled: label === "in-progress"
      }
    });
  }

  const overdue = await createSession(
    "overdue",
    "2026-10-02T07:00:00.000Z",
    "2026-10-02T08:00:00.000Z",
    SessionStatus.SCHEDULED
  );
  const inProgress = await createSession(
    "in-progress",
    "2026-10-02T09:00:00.000Z",
    "2026-10-02T10:00:00.000Z",
    SessionStatus.SCHEDULED
  );
  const upcoming = await createSession(
    "upcoming",
    "2026-10-02T12:00:00.000Z",
    "2026-10-02T13:00:00.000Z",
    SessionStatus.SCHEDULED
  );
  const completed = await createSession(
    "completed",
    "2026-10-02T05:00:00.000Z",
    "2026-10-02T06:00:00.000Z",
    SessionStatus.COMPLETED,
    "2026-10-02T06:05:00.000Z"
  );
  const cancelled = await createSession(
    "cancelled",
    "2026-10-02T14:00:00.000Z",
    "2026-10-02T15:00:00.000Z",
    SessionStatus.CANCELLED
  );

  await prisma.attendance.create({
    data: {
      sessionId: completed.id,
      childId: regularChild.id,
      coachId: group.primaryCoachId,
      status: AttendanceStatus.PRESENT,
      markedAt: new Date("2026-10-02T05:30:00.000Z")
    }
  });

  await prisma.attendance.create({
    data: {
      sessionId: inProgress.id,
      childId: regularChild.id,
      coachId: group.primaryCoachId,
      status: AttendanceStatus.PRESENT,
      markedAt: new Date("2026-10-02T09:15:00.000Z")
    }
  });

  const lead = await prisma.lead.create({
    data: {
      status: LeadStatus.TRIAL_CONFIRMED,
      parentName: trialParent.name,
      childName: trialChild.name,
      phone: trialParent.phone,
      childAge: 11,
      locale: "ru",
      source: "ci-admin-sessions",
      groupId: group.id,
      selectedSessionId: inProgress.id,
      parentId: trialParent.id,
      childId: trialChild.id
    }
  });

  const booking = await prisma.trialBooking.create({
    data: {
      leadId: lead.id,
      sessionId: inProgress.id,
      status: TrialBookingStatus.CONFIRMED,
      expiresAt: new Date("2026-10-02T12:00:00.000Z"),
      confirmedAt: new Date("2026-10-01T12:00:00.000Z")
    }
  });

  const today = await getAdminSessions({
    scope: "today",
    groupId: group.id,
    now: referenceNow,
    todayStart,
    tomorrowStart
  });

  assert(today.length === 5, "Today scope did not return every session");

  const states = new Map(
    today.map((row) => [row.session.id, row.operationalState])
  );

  assert(states.get(overdue.id) === "OVERDUE", "Overdue state is wrong");
  assert(
    states.get(inProgress.id) === "IN_PROGRESS",
    "In-progress state is wrong"
  );
  assert(states.get(upcoming.id) === "UPCOMING", "Upcoming state is wrong");
  assert(
    states.get(completed.id) === "COMPLETED",
    "Completed state is wrong"
  );
  assert(
    states.get(cancelled.id) === "CANCELLED",
    "Cancelled state is wrong"
  );

  const overdueRows = await getAdminSessions({
    scope: "overdue",
    groupId: group.id,
    now: referenceNow,
    todayStart,
    tomorrowStart
  });
  assert(
    overdueRows.length === 1 &&
      overdueRows[0].session.id === overdue.id,
    "Overdue scope is incorrect"
  );

  const completedRows = await getAdminSessions({
    scope: "completed",
    groupId: group.id,
    now: referenceNow,
    todayStart,
    tomorrowStart
  });
  assert(
    completedRows.length === 1 &&
      completedRows[0].session.id === completed.id,
    "Completed scope is incorrect"
  );

  const cancelledRows = await getAdminSessions({
    scope: "cancelled",
    groupId: group.id,
    now: referenceNow,
    todayStart,
    tomorrowStart
  });
  assert(
    cancelledRows.length === 1 &&
      cancelledRows[0].session.id === cancelled.id,
    "Cancelled scope is incorrect"
  );

  const detail = await getAdminSessionDetail(
    inProgress.id,
    referenceNow
  );

  assert(detail, "Admin session detail not found");
  assert(detail.expected === 2, "Expected participant count is wrong");
  assert(detail.marked === 1, "Marked participant count is wrong");
  assert(detail.present === 1, "Present count is wrong");
  assert(detail.trials === 1, "Trial participant count is wrong");
  assert(
    detail.participants.some(
      (participant) =>
        participant.childId === trialChild.id &&
        participant.source === "TRIAL" &&
        participant.trialBookingId === booking.id
    ),
    "Trial participant is missing from session detail"
  );
  assert(
    detail.participants.some(
      (participant) =>
        participant.childId === regularChild.id &&
        participant.source === "REGULAR" &&
        participant.attendanceStatus === "PRESENT"
    ),
    "Regular attendance is missing from session detail"
  );

  const filteredByCoach = await getAdminSessions({
    scope: "today",
    coachId: group.primaryCoachId,
    groupId: group.id,
    now: referenceNow,
    todayStart,
    tomorrowStart
  });

  assert(
    filteredByCoach.length === 5,
    "Coach/group filters removed valid sessions"
  );

  await prisma.attendance.deleteMany({
    where: {
      sessionId: {
        in: [
          overdue.id,
          inProgress.id,
          upcoming.id,
          completed.id,
          cancelled.id
        ]
      }
    }
  });
  await prisma.trialBooking.delete({
    where: { id: booking.id }
  });
  await prisma.lead.delete({
    where: { id: lead.id }
  });
  await prisma.trainingSession.deleteMany({
    where: { groupId: group.id }
  });
  await prisma.studentEnrollment.deleteMany({
    where: { groupId: group.id }
  });
  await prisma.child.deleteMany({
    where: {
      id: { in: [regularChild.id, trialChild.id] }
    }
  });
  await prisma.parent.deleteMany({
    where: {
      id: { in: [regularParent.id, trialParent.id] }
    }
  });
  await prisma.trainingGroup.delete({
    where: { id: group.id }
  });

  console.log("Admin sessions operations smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
