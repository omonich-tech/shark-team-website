import "dotenv/config";
import {
  AbsenceReason,
  AttendanceReasonSource,
  AttendanceStatus,
  NotificationStatus,
  NotificationType,
  StudentEnrollmentStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import { getCoachSessionParticipants } from "../src/server/coach/get-session-participants";
import { markCoachAttendance } from "../src/server/coach/mark-attendance";
import {
  buildParentAbsenceSessionPicker,
  handleParentAbsenceCallback
} from "../src/server/telegram/parent-cabinet";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(webhookSecret, "Telegram webhook secret is missing");

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      child: { name: "Regular Child" },
      status: StudentEnrollmentStatus.ACTIVE
    },
    include: {
      child: { include: { parent: true } },
      group: true
    }
  });

  assert(enrollment, "Regular enrollment not found");

  const session = await prisma.trainingSession.findFirst({
    where: {
      groupId: enrollment.groupId,
      status: "SCHEDULED",
      startsAt: { gt: new Date() }
    },
    orderBy: { startsAt: "asc" }
  });

  assert(session, "Future regular session not found");

  await prisma.attendance.deleteMany({
    where: {
      sessionId: session.id,
      childId: enrollment.childId
    }
  });

  const telegramUserId = 777021n;
  const chatId = 777021n;

  await prisma.telegramContact.upsert({
    where: { telegramUserId },
    update: {
      parentId: enrollment.child.parentId,
      leadId: null,
      chatId,
      locale: "ru",
      verifiedAt: new Date()
    },
    create: {
      parentId: enrollment.child.parentId,
      telegramUserId,
      chatId,
      username: "ci_absence_parent",
      firstName: "CI Absence Parent",
      languageCode: "ru",
      locale: "ru",
      verifiedAt: new Date()
    }
  });

  const picker = await buildParentAbsenceSessionPicker(
    telegramUserId,
    enrollment.childId
  );

  assert(picker.ok, "Absence session picker did not open");
  assert(
    picker.text.includes("Сообщить об отсутствии"),
    "Absence picker heading is missing"
  );
  assert(
    JSON.stringify(picker.replyMarkup).includes("pa:s:"),
    "Absence session callback is missing"
  );

  const reasonStep = await handleParentAbsenceCallback(
    telegramUserId,
    "pa:s:" + enrollment.childId + ":" + session.id
  );

  assert(reasonStep?.ok, "Absence reason step did not open");
  assert(
    reasonStep.text.includes("Выберите причину"),
    "Absence reason prompt is missing"
  );
  assert(
    JSON.stringify(reasonStep.replyMarkup).includes("pa:r:I:"),
    "Illness reason callback is missing"
  );

  const confirmStep = await handleParentAbsenceCallback(
    telegramUserId,
    "pa:r:I:" + enrollment.childId + ":" + session.id
  );

  assert(confirmStep?.ok, "Absence confirmation step did not open");
  assert(
    confirmStep.text.includes("Подтвердить отсутствие"),
    "Absence confirmation prompt is missing"
  );

  const confirmed = await handleParentAbsenceCallback(
    telegramUserId,
    "pa:c:I:" + enrollment.childId + ":" + session.id
  );

  assert(confirmed?.ok, "Parent absence was not confirmed");

  let attendance = await prisma.attendance.findUnique({
    where: {
      sessionId_childId: {
        sessionId: session.id,
        childId: enrollment.childId
      }
    }
  });

  assert(attendance, "Planned absence attendance was not created");
  assert(
    attendance.status === AttendanceStatus.EXCUSED,
    "Planned absence must be EXCUSED"
  );
  assert(
    attendance.absenceReason === AbsenceReason.ILLNESS,
    "Planned absence reason was not persisted"
  );
  assert(
    attendance.reasonSource === AttendanceReasonSource.PARENT,
    "Planned absence source must be PARENT"
  );

  const participants = await getCoachSessionParticipants(
    session.coachId,
    session.id
  );

  const participant = participants?.participants.find(
    (item) => item.childId === enrollment.childId
  );

  assert(participant, "Coach participant was not found");
  assert(
    participant.reasonSource === AttendanceReasonSource.PARENT,
    "Coach view does not expose PARENT reason source"
  );
  assert(
    participant.absenceReason === AbsenceReason.ILLNESS,
    "Coach view does not expose parent reason"
  );

  const coachMarked = await markCoachAttendance({
    coachId: session.coachId,
    sessionId: session.id,
    childId: enrollment.childId,
    status: AttendanceStatus.EXCUSED,
    absenceReason: AbsenceReason.ILLNESS,
    absenceNote: null
  });

  assert(coachMarked.ok, "Coach could not confirm planned absence");

  attendance = await prisma.attendance.findUnique({
    where: {
      sessionId_childId: {
        sessionId: session.id,
        childId: enrollment.childId
      }
    }
  });

  assert(
    attendance?.reasonSource === AttendanceReasonSource.PARENT,
    "Coach confirmation overwrote PARENT reason source"
  );

  const unnecessaryNotice = await prisma.notification.findFirst({
    where: {
      attendanceId: attendance?.id,
      type: NotificationType.REGULAR_ABSENCE_NOTICE,
      status: NotificationStatus.PENDING
    }
  });

  assert(
    !unnecessaryNotice,
    "Parent who reported absence received an unnecessary reason request"
  );

  const webhookResponse = await fetch(
    baseUrl + "/api/telegram/webhook",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": webhookSecret
      },
      body: JSON.stringify({
        update_id: 9101,
        callback_query: {
          id: "ci-planned-absence",
          data:
            "pa:s:" +
            enrollment.childId +
            ":" +
            session.id,
          from: {
            id: Number(telegramUserId),
            username: "ci_absence_parent",
            first_name: "CI Absence Parent"
          },
          message: {
            chat: { id: Number(chatId), type: "private" }
          }
        }
      })
    }
  );

  assert(webhookResponse.ok, "Parent absence Telegram callback failed");

  console.log("Parent planned absence smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
