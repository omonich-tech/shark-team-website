import "dotenv/config";
import {
  OperationalAlertStatus,
  OperationalAlertType,
  StudentEnrollmentStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import { createStudentProgressAssessment } from "../src/server/progress/student-progress";
import { refreshProgressOverdueAlert } from "../src/server/progress/progress-alerts";

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

  assert(enrollment, "Progress alert enrollment not found");

  await prisma.operationalAlert.deleteMany({
    where: {
      type: OperationalAlertType.PROGRESS_OVERDUE,
      enrollmentId: enrollment.id
    }
  });

  await prisma.studentProgressAssessment.deleteMany({
    where: {
      childId: enrollment.childId,
      groupId: enrollment.groupId
    }
  });

  const now = new Date("2026-12-15T10:00:00.000Z");
  const opened = await refreshProgressOverdueAlert({
    childId: enrollment.childId,
    groupId: enrollment.groupId,
    now
  });

  assert(opened.overdue, "Missing assessment did not open overdue progress alert");

  let alert = await prisma.operationalAlert.findUnique({
    where: { dedupeKey: "progress-overdue:" + enrollment.id }
  });

  assert(alert, "Progress overdue alert was not persisted");
  assert(alert.status === OperationalAlertStatus.OPEN, "Progress overdue alert is not OPEN");
  assert(alert.type === OperationalAlertType.PROGRESS_OVERDUE, "Wrong progress alert type");

  const result = await createStudentProgressAssessment({
    coachId: enrollment.group.primaryCoachId,
    childId: enrollment.childId,
    scores: {
      ability: 4,
      discipline: 4,
      motivation: 5,
      coordination: 4,
      physicalPreparation: 4,
      psychologicalReadiness: 4
    },
    coachComment: "CI overdue progress resolution",
    recommendation: "Continue regular training",
    now
  });

  assert(result.ok, "Could not create assessment to resolve progress alert");

  alert = await prisma.operationalAlert.findUnique({
    where: { dedupeKey: "progress-overdue:" + enrollment.id }
  });

  assert(
    alert?.status === OperationalAlertStatus.RESOLVED,
    "Progress overdue alert was not resolved after assessment"
  );
  assert(alert.resolvedAt, "Resolved progress alert has no resolvedAt");

  await prisma.notification.deleteMany({
    where: { progressAssessmentId: result.assessment.id }
  });
  await prisma.studentProgressAssessment.delete({
    where: { id: result.assessment.id }
  });

  console.log("Progress overdue alert verification passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
