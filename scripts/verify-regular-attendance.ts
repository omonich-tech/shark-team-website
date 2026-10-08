import "dotenv/config";
import {
  AbsenceReason,
  AttendanceStatus,
  SessionStatus,
  StudentEnrollmentStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import {
  setParentAttendanceReason
} from "../src/server/attendance/absence-reason";
import { markCoachAttendance } from "../src/server/coach/mark-attendance";

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

  let session = await prisma.trainingSession.findFirst({
    where: {
      groupId: enrollment.groupId,
      startsAt: {
        gte: enrollment.startDate
      },
      status: SessionStatus.SCHEDULED,
      trialBookings: {
        none: {
          lead: {
            childId: child.id
          }
        }
      }
    },
    orderBy: {
      startsAt: "asc"
    }
  });

  let createdSessionId: string | null = null;

  if (!session) {
    let startsAt = new Date(
      Math.max(
        enrollment.startDate.getTime() + 60 * 60 * 1000,
        Date.now() - 30 * 60 * 1000
      )
    );

    while (
      await prisma.trainingSession.findUnique({
        where: {
          groupId_startsAt: {
            groupId: enrollment.groupId,
            startsAt
          }
        },
        select: { id: true }
      })
    ) {
      startsAt = new Date(startsAt.getTime() + 7 * 60 * 1000);
    }

    session = await prisma.trainingSession.create({
      data: {
        groupId: enrollment.groupId,
        coachId: enrollment.group.primaryCoachId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
        status: SessionStatus.SCHEDULED,
        regularCapacity: enrollment.group.capacityRegular,
        trialCapacity: 0,
        trialBookingEnabled: false
      }
    });

    createdSessionId = session.id;
  }

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

  const noticeBeforeCompletion =
    await prisma.notification.findUnique({
      where: {
        dedupeKey: "attendance:" + absent.attendance.id + ":absence"
      }
    });

  assert(
    noticeBeforeCompletion === null,
    "Absence follow-up must wait for session completion"
  );

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

  if (createdSessionId) {
    await prisma.trainingSession.delete({
      where: { id: createdSessionId }
    });
  }

  console.log("Regular attendance workflow verification passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
