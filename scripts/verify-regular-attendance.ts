import "dotenv/config";
import {
  AbsenceReason,
  AttendanceStatus,
  NotificationStatus,
  NotificationType,
  StudentEnrollmentStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import {
  setParentAttendanceReason
} from "../src/server/attendance/absence-reason";
import { markCoachAttendance } from "../src/server/coach/mark-attendance";
import { processDueTelegramNotifications } from "../src/server/notifications/telegram-notifications";

const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const child = await prisma.child.findFirst({
    where: { name: "Coach Trial Child" },
    include: {
      parent: true,
      enrollments: {
        where: { status: StudentEnrollmentStatus.ACTIVE },
        include: {
          group: true
        },
        take: 1
      }
    }
  });

  assert(child, "Attendance smoke child not found");
  const enrollment = child.enrollments[0];
  assert(enrollment, "Attendance smoke enrollment not found");

  const session = await prisma.trainingSession.findFirst({
    where: {
      groupId: enrollment.groupId,
      startsAt: {
        gte: enrollment.startDate
      }
    },
    orderBy: {
      startsAt: "asc"
    }
  });

  assert(session, "Attendance smoke session not found");

  await prisma.attendance.deleteMany({
    where: {
      sessionId: session.id,
      childId: child.id,
      trialBookingId: null
    }
  });

  const absent = await markCoachAttendance({
    coachId: session.coachId,
    sessionId: session.id,
    childId: child.id,
    status: AttendanceStatus.ABSENT
  });

  assert(absent.ok, "Could not mark regular student absent");
  assert(
    absent.attendance.absenceReason === null,
    "Unexpected absence reason before parent response"
  );

  const notice = await prisma.notification.findUnique({
    where: {
      dedupeKey: "attendance:" + absent.attendance.id + ":absence"
    }
  });

  assert(notice, "Absence notification was not queued");
  assert(
    notice.type === NotificationType.REGULAR_ABSENCE_NOTICE,
    "Wrong absence notification type"
  );
  assert(
    notice.status === NotificationStatus.PENDING,
    "Absence notification should start PENDING"
  );

  const sent = await processDueTelegramNotifications(
    new Date(Date.now() + 60_000)
  );

  assert(sent.sent >= 1, "Absence notification was not sent");

  const reason = await setParentAttendanceReason({
    telegramUserId: BigInt(777001),
    attendanceId: absent.attendance.id,
    reason: AbsenceReason.ILLNESS
  });

  assert(reason.ok, "Parent could not save absence reason");

  let attendance = await prisma.attendance.findUnique({
    where: { id: absent.attendance.id }
  });

  assert(
    attendance?.absenceReason === AbsenceReason.ILLNESS,
    "Parent absence reason was not stored"
  );
  assert(
    attendance?.reasonSource === "PARENT",
    "Parent absence reason source was not stored"
  );

  const present = await markCoachAttendance({
    coachId: session.coachId,
    sessionId: session.id,
    childId: child.id,
    status: AttendanceStatus.PRESENT
  });

  assert(present.ok, "Could not change attendance to PRESENT");

  attendance = await prisma.attendance.findUnique({
    where: { id: absent.attendance.id }
  });

  assert(
    attendance?.status === AttendanceStatus.PRESENT,
    "Attendance did not change to PRESENT"
  );
  assert(
    attendance?.absenceReason === null &&
      attendance?.absenceNote === null &&
      attendance?.reasonSource === null,
    "Presence did not clear absence metadata"
  );

  await prisma.notification.deleteMany({
    where: {
      attendanceId: absent.attendance.id
    }
  });
  await prisma.attendance.delete({
    where: { id: absent.attendance.id }
  });

  console.log("Regular attendance workflow verification passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
