import "dotenv/config";
import {
  NotificationStatus,
  NotificationType,
  StudentEnrollmentStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import { processDueTelegramNotifications } from "../src/server/notifications/telegram-notifications";
import { createStudentProgressAssessment } from "../src/server/progress/student-progress";

const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const child = await prisma.child.findFirst({
    where: { name: "Coach Trial Child" },
    include: {
      enrollments: {
        where: { status: StudentEnrollmentStatus.ACTIVE },
        include: { group: true },
        take: 1
      }
    }
  });

  assert(child, "Progress smoke child not found");
  const enrollment = child.enrollments[0];
  assert(enrollment, "Progress smoke enrollment not found");

  const result = await createStudentProgressAssessment({
    coachId: enrollment.group.primaryCoachId,
    childId: child.id,
    scores: {
      ability: 4,
      discipline: 5,
      motivation: 4,
      coordination: 4,
      physicalPreparation: 3,
      psychologicalReadiness: 4
    },
    coachComment: "CI progress check",
    recommendation: "Keep training consistently"
  });

  assert(result.ok, "Could not create student progress assessment");

  const notice = await prisma.notification.findUnique({
    where: {
      dedupeKey: "progress:" + result.assessment.id + ":parent"
    }
  });

  assert(notice, "Progress notification was not queued");
  assert(
    notice.type === NotificationType.STUDENT_PROGRESS_UPDATE &&
      notice.status === NotificationStatus.PENDING,
    "Progress notification state is invalid"
  );

  const processed = await processDueTelegramNotifications(
    new Date(Date.now() + 60_000)
  );

  assert(processed.sent >= 1, "Progress notification was not sent");

  const saved = await prisma.studentProgressAssessment.findUnique({
    where: { id: result.assessment.id }
  });

  assert(saved, "Progress assessment was not persisted");
  assert(saved.discipline === 5, "Progress score was not persisted");

  await prisma.notification.deleteMany({
    where: { progressAssessmentId: result.assessment.id }
  });
  await prisma.studentProgressAssessment.delete({
    where: { id: result.assessment.id }
  });

  console.log("Student progress workflow verification passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
