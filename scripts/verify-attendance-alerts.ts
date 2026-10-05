import "dotenv/config";
import {
  AttendanceStatus,
  OperationalAlertStatus,
  OperationalAlertType,
  SessionStatus,
  StudentEnrollmentStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import { refreshAttendanceRiskAlert } from "../src/server/attendance/risk-alerts";

const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      child: { name: "Coach Trial Child" },
      status: StudentEnrollmentStatus.ACTIVE
    },
    include: {
      child: true,
      group: true
    },
    orderBy: { createdAt: "asc" }
  });

  assert(enrollment, "Attendance alert enrollment not found");

  let sessions = await prisma.trainingSession.findMany({
    where: {
      groupId: enrollment.groupId,
      startsAt: { gte: enrollment.startDate },
      trialBookings: {
        none: {
          lead: {
            childId: enrollment.childId
          }
        }
      }
    },
    orderBy: { startsAt: "asc" },
    take: 3
  });

  const createdSessionIds: string[] = [];

  if (sessions.length < 3) {
    const missing = 3 - sessions.length;
    const base = new Date(
      Math.max(
        enrollment.startDate.getTime() + 6 * 60 * 60 * 1000,
        Date.now() - 10 * 24 * 60 * 60 * 1000
      )
    );

    for (let index = 0; index < missing; index += 1) {
      let startsAt = new Date(
        base.getTime() + (index + 1) * 7 * 60 * 60 * 1000 + 37 * 60 * 1000
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
        startsAt = new Date(startsAt.getTime() + 11 * 60 * 1000);
      }

      const created = await prisma.trainingSession.create({
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

      createdSessionIds.push(created.id);
    }

    sessions = await prisma.trainingSession.findMany({
      where: {
        groupId: enrollment.groupId,
        startsAt: { gte: enrollment.startDate },
        trialBookings: {
          none: {
            lead: {
              childId: enrollment.childId
            }
          }
        }
      },
      orderBy: { startsAt: "asc" },
      take: 3
    });
  }

  assert(
    sessions.length >= 3,
    "Need at least three sessions for attendance alert test"
  );

  await prisma.operationalAlert.deleteMany({
    where: {
      type: OperationalAlertType.ATTENDANCE_RISK,
      enrollmentId: enrollment.id
    }
  });

  await prisma.attendance.deleteMany({
    where: {
      childId: enrollment.childId,
      trialBookingId: null,
      session: { groupId: enrollment.groupId }
    }
  });

  for (const session of sessions.slice(0, 2)) {
    await prisma.attendance.create({
      data: {
        sessionId: session.id,
        childId: enrollment.childId,
        coachId: session.coachId,
        status: AttendanceStatus.ABSENT,
        markedAt: new Date(session.startsAt.getTime() + 5 * 60 * 1000)
      }
    });
  }

  const riskNow = new Date(sessions[1].endsAt.getTime() + 60_000);
  const opened = await refreshAttendanceRiskAlert({
    childId: enrollment.childId,
    groupId: enrollment.groupId,
    now: riskNow
  });

  assert(opened.risk, "Two consecutive absences did not open attendance risk");
  assert(
    opened.consecutiveMisses === 2,
    "Attendance risk consecutive count is wrong"
  );

  let alert = await prisma.operationalAlert.findUnique({
    where: { dedupeKey: "attendance-risk:" + enrollment.id }
  });

  assert(alert, "Persistent attendance risk alert was not created");
  assert(
    alert.status === OperationalAlertStatus.OPEN,
    "Attendance risk alert is not OPEN"
  );
  assert(
    alert.type === OperationalAlertType.ATTENDANCE_RISK,
    "Attendance alert type is wrong"
  );
  assert(
    alert.childId === enrollment.childId,
    "Attendance alert child link is wrong"
  );
  assert(
    alert.groupId === enrollment.groupId,
    "Attendance alert group link is wrong"
  );

  const recoverySession = sessions[2];
  await prisma.attendance.create({
    data: {
      sessionId: recoverySession.id,
      childId: enrollment.childId,
      coachId: recoverySession.coachId,
      status: AttendanceStatus.PRESENT,
      markedAt: new Date(recoverySession.startsAt.getTime() + 5 * 60 * 1000)
    }
  });

  const recovered = await refreshAttendanceRiskAlert({
    childId: enrollment.childId,
    groupId: enrollment.groupId,
    now: new Date(recoverySession.endsAt.getTime() + 60_000)
  });

  assert(!recovered.risk, "Attendance risk did not clear after recovery");

  alert = await prisma.operationalAlert.findUnique({
    where: { dedupeKey: "attendance-risk:" + enrollment.id }
  });

  assert(
    alert?.status === OperationalAlertStatus.RESOLVED,
    "Attendance risk alert was not auto-resolved"
  );
  assert(alert.resolvedAt, "Resolved attendance alert has no resolvedAt");

  await prisma.attendance.deleteMany({
    where: {
      childId: enrollment.childId,
      trialBookingId: null,
      sessionId: { in: sessions.map((session) => session.id) }
    }
  });

  if (createdSessionIds.length > 0) {
    await prisma.trainingSession.deleteMany({
      where: { id: { in: createdSessionIds } }
    });
  }

  console.log("Attendance risk alert verification passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
