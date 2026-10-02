import "dotenv/config";
import {
  AttendanceStatus,
  AuditActorType,
  NotificationStatus,
  NotificationType,
  SessionStatus,
  StudentEnrollmentStatus,
  SubscriptionStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import { markCoachAttendance } from "../src/server/coach/mark-attendance";
import {
  completeCoachTrainingSession,
  reopenTrainingSession
} from "../src/server/sessions/complete-training-session";

const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function plusMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

async function main() {
  const group = await prisma.trainingGroup.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" }
  });

  assert(group, "Group for session completion smoke not found");

  const now = new Date();
  const startsAt = plusMinutes(now, -90);
  startsAt.setUTCSeconds(0, 0);
  const endsAt = plusMinutes(startsAt, 60);

  const parentA = await prisma.parent.create({
    data: {
      name: "CI Completion Parent A",
      phone: "+998900077031",
      locale: "ru"
    }
  });
  const parentB = await prisma.parent.create({
    data: {
      name: "CI Completion Parent B",
      phone: "+998900077032",
      locale: "ru"
    }
  });

  const childA = await prisma.child.create({
    data: {
      parentId: parentA.id,
      name: "CI Completion Child A",
      ageAtRegistration: 10
    }
  });
  const childB = await prisma.child.create({
    data: {
      parentId: parentB.id,
      name: "CI Completion Child B",
      ageAtRegistration: 11
    }
  });

  const paidUntil = plusMinutes(now, 60 * 24 * 30);

  const enrollmentA = await prisma.studentEnrollment.create({
    data: {
      childId: childA.id,
      groupId: group.id,
      status: StudentEnrollmentStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      startDate: plusMinutes(startsAt, -24 * 60),
      currentPeriodStart: plusMinutes(startsAt, -24 * 60),
      currentPeriodEnd: paidUntil,
      nextPaymentDueAt: paidUntil
    }
  });

  const enrollmentB = await prisma.studentEnrollment.create({
    data: {
      childId: childB.id,
      groupId: group.id,
      status: StudentEnrollmentStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      startDate: plusMinutes(startsAt, -24 * 60),
      currentPeriodStart: plusMinutes(startsAt, -24 * 60),
      currentPeriodEnd: paidUntil,
      nextPaymentDueAt: paidUntil
    }
  });

  await prisma.telegramContact.createMany({
    data: [
      {
        parentId: parentA.id,
        telegramUserId: 777031n,
        chatId: 777031n,
        locale: "ru"
      },
      {
        parentId: parentB.id,
        telegramUserId: 777032n,
        chatId: 777032n,
        locale: "ru"
      }
    ]
  });

  const session = await prisma.trainingSession.create({
    data: {
      groupId: group.id,
      coachId: group.primaryCoachId,
      startsAt,
      endsAt,
      status: SessionStatus.SCHEDULED,
      regularCapacity: group.capacityRegular,
      trialCapacity: group.capacityTrial,
      trialBookingEnabled: false
    }
  });

  const firstMark = await markCoachAttendance({
    coachId: group.primaryCoachId,
    sessionId: session.id,
    childId: childA.id,
    status: AttendanceStatus.PRESENT
  });

  assert(firstMark.ok, "Could not mark first student present");

  const incomplete = await completeCoachTrainingSession({
    coachId: group.primaryCoachId,
    sessionId: session.id,
    now
  });

  assert(
    !incomplete.ok && incomplete.error === "ATTENDANCE_INCOMPLETE",
    "Session completed with unmarked participant"
  );
  assert(
    incomplete.unmarked.some((item) => item.childId === childB.id),
    "Incomplete response did not identify unmarked child"
  );

  const absent = await markCoachAttendance({
    coachId: group.primaryCoachId,
    sessionId: session.id,
    childId: childB.id,
    status: AttendanceStatus.ABSENT
  });

  assert(absent.ok, "Could not mark second student absent");

  const noticeBeforeCompletion = await prisma.notification.findUnique({
    where: {
      dedupeKey: "attendance:" + absent.attendance.id + ":absence"
    }
  });

  assert(
    noticeBeforeCompletion === null,
    "Absence follow-up was queued before session completion"
  );

  const completed = await completeCoachTrainingSession({
    coachId: group.primaryCoachId,
    sessionId: session.id,
    now
  });

  assert(completed.ok, "Session completion failed");
  assert(
    completed.summary.participants === 2 &&
      completed.summary.present === 1 &&
      completed.summary.absent === 1,
    "Completion summary is incorrect"
  );

  let storedSession = await prisma.trainingSession.findUnique({
    where: { id: session.id }
  });

  assert(
    storedSession?.status === SessionStatus.COMPLETED,
    "Session did not become COMPLETED"
  );
  assert(
    storedSession.completedAt?.getTime() === now.getTime(),
    "Session completion timestamp was not stored"
  );

  const followUp = await prisma.notification.findUnique({
    where: {
      dedupeKey: "attendance:" + absent.attendance.id + ":absence"
    }
  });

  assert(followUp, "Absence follow-up was not queued on completion");
  assert(
    followUp.type === NotificationType.REGULAR_ABSENCE_NOTICE &&
      followUp.status === NotificationStatus.PENDING,
    "Absence follow-up has wrong state"
  );

  const lockedMark = await markCoachAttendance({
    coachId: group.primaryCoachId,
    sessionId: session.id,
    childId: childB.id,
    status: AttendanceStatus.PRESENT
  });

  assert(
    !lockedMark.ok && lockedMark.error === "SESSION_LOCKED",
    "Coach could edit attendance after completion"
  );

  const coachAudit = await prisma.auditLog.findFirst({
    where: {
      entityType: "TrainingSession",
      entityId: session.id,
      action: "COMPLETE_TRAINING_SESSION"
    },
    orderBy: { createdAt: "desc" }
  });

  assert(
    coachAudit?.actorType === AuditActorType.COACH &&
      coachAudit.actorId === group.primaryCoachId,
    "Coach completion audit was not written"
  );

  const reopened = await reopenTrainingSession({
    adminId: "ci-admin",
    sessionId: session.id,
    reason: "CI correction",
    now: plusMinutes(now, 1)
  });

  assert(reopened.ok, "Admin could not reopen completed session");

  storedSession = await prisma.trainingSession.findUnique({
    where: { id: session.id }
  });

  assert(
    storedSession?.status === SessionStatus.SCHEDULED &&
      storedSession.completedAt === null,
    "Reopened session did not return to editable state"
  );

  const followUpAfterReopen = await prisma.notification.findUnique({
    where: { id: followUp.id }
  });

  assert(
    followUpAfterReopen?.status === NotificationStatus.SKIPPED &&
      followUpAfterReopen.lastError === "SESSION_REOPENED",
    "Pending absence follow-up was not stopped on reopen"
  );

  const adminAudit = await prisma.auditLog.findFirst({
    where: {
      entityType: "TrainingSession",
      entityId: session.id,
      action: "REOPEN_TRAINING_SESSION"
    },
    orderBy: { createdAt: "desc" }
  });

  assert(
    adminAudit?.actorType === AuditActorType.ADMIN &&
      adminAudit.actorId === "ci-admin",
    "Admin reopen audit was not written"
  );

  const corrected = await markCoachAttendance({
    coachId: group.primaryCoachId,
    sessionId: session.id,
    childId: childB.id,
    status: AttendanceStatus.PRESENT
  });

  assert(corrected.ok, "Attendance was not editable after reopen");

  const completedAgain = await completeCoachTrainingSession({
    coachId: group.primaryCoachId,
    sessionId: session.id,
    now: plusMinutes(now, 2)
  });

  assert(completedAgain.ok, "Reopened session could not be completed again");
  assert(
    completedAgain.summary.present === 2 &&
      completedAgain.summary.absent === 0,
    "Corrected completion summary is incorrect"
  );

  const followUpAfterRecompletion = await prisma.notification.findUnique({
    where: { id: followUp.id }
  });

  assert(
    followUpAfterRecompletion?.status === NotificationStatus.SKIPPED,
    "Corrected present attendance reactivated old absence follow-up"
  );

  const completionAuditCount = await prisma.auditLog.count({
    where: {
      entityType: "TrainingSession",
      entityId: session.id,
      action: "COMPLETE_TRAINING_SESSION",
      actorType: AuditActorType.COACH
    }
  });

  assert(
    completionAuditCount === 2,
    "Every completion was not written to audit history"
  );

  await prisma.notification.deleteMany({
    where: {
      attendance: {
        is: { sessionId: session.id }
      }
    }
  });
  await prisma.auditLog.deleteMany({
    where: {
      entityType: "TrainingSession",
      entityId: session.id
    }
  });
  await prisma.attendance.deleteMany({
    where: { sessionId: session.id }
  });
  await prisma.trainingSession.delete({
    where: { id: session.id }
  });
  await prisma.studentEnrollment.deleteMany({
    where: {
      id: { in: [enrollmentA.id, enrollmentB.id] }
    }
  });
  await prisma.telegramContact.deleteMany({
    where: {
      telegramUserId: { in: [777031n, 777032n] }
    }
  });
  await prisma.child.deleteMany({
    where: {
      id: { in: [childA.id, childB.id] }
    }
  });
  await prisma.parent.deleteMany({
    where: {
      id: { in: [parentA.id, parentB.id] }
    }
  });

  console.log("Coach session completion smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
