import "dotenv/config";
import {
  NotificationStatus,
  NotificationType,
  SessionStatus,
  StudentEnrollmentStatus,
  SubscriptionStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import { processDueTelegramNotifications } from "../src/server/notifications/telegram-notifications";
import { queueUpcomingRegularSessionReminders } from "../src/server/notifications/regular-session-notifications";
import {
  cancelRegularTrainingSession,
  rescheduleRegularTrainingSession
} from "../src/server/sessions/manage-training-session";

const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function plusMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60_000);
}

async function main() {
  const group = await prisma.trainingGroup.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" }
  });

  assert(group, "Training group for session notification smoke not found");

  const phone = "+998900077030";
  const telegramUserId = 777030n;

  await prisma.parent.deleteMany({
    where: { phone }
  });

  const parent = await prisma.parent.create({
    data: {
      name: "CI Session Notification Parent",
      phone,
      locale: "ru"
    }
  });

  const child = await prisma.child.create({
    data: {
      parentId: parent.id,
      name: "CI Session Notification Child",
      ageAtRegistration: 10
    }
  });

  const now = new Date();
  const paidUntil = plusMinutes(now, 90 * 24 * 60);

  const enrollment = await prisma.studentEnrollment.create({
    data: {
      childId: child.id,
      groupId: group.id,
      status: StudentEnrollmentStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      startDate: now,
      currentPeriodStart: now,
      currentPeriodEnd: paidUntil,
      nextPaymentDueAt: paidUntil,
      graceUntil: plusMinutes(paidUntil, 3 * 24 * 60)
    }
  });

  await prisma.telegramContact.create({
    data: {
      parentId: parent.id,
      telegramUserId,
      chatId: telegramUserId,
      username: "ci_session_notifications",
      firstName: "CI Session Parent",
      languageCode: "ru",
      locale: "ru"
    }
  });

  const reminderStart = plusMinutes(now, 120);
  reminderStart.setUTCSeconds(0, 0);
  const reminderEnd = plusMinutes(reminderStart, 60);

  const reminderSession = await prisma.trainingSession.create({
    data: {
      groupId: group.id,
      coachId: group.primaryCoachId,
      startsAt: reminderStart,
      endsAt: reminderEnd,
      status: SessionStatus.SCHEDULED,
      regularCapacity: group.capacityRegular,
      trialCapacity: group.capacityTrial,
      trialBookingEnabled: false
    }
  });

  const queuedDue = await queueUpcomingRegularSessionReminders(
    now,
    36
  );

  assert(queuedDue.created >= 1, "Regular reminder was not queued");

  const reminder = await prisma.notification.findUnique({
    where: {
      dedupeKey:
        "regular-session:" +
        reminderSession.id +
        ":enrollment:" +
        enrollment.id +
        ":reminder"
    }
  });

  assert(reminder, "Reminder notification row not found");
  assert(
    reminder.type === NotificationType.REGULAR_SESSION_REMINDER,
    "Reminder notification has wrong type"
  );
  assert(
    reminder.scheduledAt <= now,
    "Reminder inside reminder window was not scheduled immediately"
  );

  const processedReminder = await processDueTelegramNotifications(
    plusMinutes(now, 1)
  );

  assert(
    processedReminder.sent >= 1,
    "Due regular session reminder was not sent"
  );

  const reminderAfterSend = await prisma.notification.findUnique({
    where: { id: reminder.id }
  });

  assert(
    reminderAfterSend?.status === NotificationStatus.SENT,
    "Regular session reminder did not become SENT"
  );

  const changeStart = plusMinutes(now, 480);
  changeStart.setUTCSeconds(0, 0);
  const changeEnd = plusMinutes(changeStart, 60);

  const changeSession = await prisma.trainingSession.create({
    data: {
      groupId: group.id,
      coachId: group.primaryCoachId,
      startsAt: changeStart,
      endsAt: changeEnd,
      status: SessionStatus.SCHEDULED,
      regularCapacity: group.capacityRegular,
      trialCapacity: group.capacityTrial,
      trialBookingEnabled: false
    }
  });

  await queueUpcomingRegularSessionReminders(now, 36);

  const changeReminderKey =
    "regular-session:" +
    changeSession.id +
    ":enrollment:" +
    enrollment.id +
    ":reminder";

  const beforeMoveReminder = await prisma.notification.findUnique({
    where: { dedupeKey: changeReminderKey }
  });

  assert(beforeMoveReminder, "Future reminder was not queued");
  assert(
    beforeMoveReminder.status === NotificationStatus.PENDING,
    "Future reminder must stay PENDING"
  );

  const movedStart = plusMinutes(now, 600);
  movedStart.setUTCSeconds(0, 0);
  const movedEnd = plusMinutes(movedStart, 60);

  const rescheduled = await rescheduleRegularTrainingSession({
    sessionId: changeSession.id,
    startsAt: movedStart,
    endsAt: movedEnd,
    now
  });

  assert(rescheduled.ok, "Regular session reschedule failed");

  const afterMoveReminder = await prisma.notification.findUnique({
    where: { dedupeKey: changeReminderKey }
  });

  assert(afterMoveReminder, "Reminder disappeared after reschedule");
  assert(
    afterMoveReminder.scheduledAt.getTime() ===
      movedStart.getTime() - 180 * 60_000,
    "Pending reminder did not move with the session"
  );

  const rescheduleNotification =
    await prisma.notification.findFirst({
      where: {
        trainingSessionId: changeSession.id,
        enrollmentId: enrollment.id,
        type: NotificationType.REGULAR_SESSION_RESCHEDULED
      },
      orderBy: { createdAt: "desc" }
    });

  assert(
    rescheduleNotification?.status === NotificationStatus.PENDING,
    "Reschedule notification was not queued"
  );

  const context = rescheduleNotification.contextJson;
  assert(
    context &&
      typeof context === "object" &&
      !Array.isArray(context) &&
      "oldStartsAt" in context &&
      "newStartsAt" in context,
    "Reschedule notification does not preserve old/new time"
  );

  await processDueTelegramNotifications(plusMinutes(now, 2));

  const rescheduleAfterSend =
    await prisma.notification.findUnique({
      where: { id: rescheduleNotification.id }
    });

  assert(
    rescheduleAfterSend?.status === NotificationStatus.SENT,
    "Reschedule notification did not become SENT"
  );

  const cancelled = await cancelRegularTrainingSession({
    sessionId: changeSession.id,
    reason: "CI hall unavailable",
    now: plusMinutes(now, 3)
  });

  assert(cancelled.ok, "Regular session cancellation failed");

  const cancelledSession = await prisma.trainingSession.findUnique({
    where: { id: changeSession.id }
  });

  assert(
    cancelledSession?.status === SessionStatus.CANCELLED,
    "Cancelled session did not become CANCELLED"
  );

  const cancelledReminder = await prisma.notification.findUnique({
    where: { dedupeKey: changeReminderKey }
  });

  assert(
    cancelledReminder?.status === NotificationStatus.SKIPPED,
    "Pending reminder was not skipped after cancellation"
  );

  const cancellationNotification =
    await prisma.notification.findFirst({
      where: {
        trainingSessionId: changeSession.id,
        enrollmentId: enrollment.id,
        type: NotificationType.REGULAR_SESSION_CANCELLED
      },
      orderBy: { createdAt: "desc" }
    });

  assert(
    cancellationNotification?.status === NotificationStatus.PENDING,
    "Cancellation notification was not queued"
  );

  await processDueTelegramNotifications(plusMinutes(now, 4));

  const cancellationAfterSend =
    await prisma.notification.findUnique({
      where: { id: cancellationNotification.id }
    });

  assert(
    cancellationAfterSend?.status === NotificationStatus.SENT,
    "Cancellation notification did not become SENT"
  );

  const changedReminderCount = await prisma.notification.count({
    where: {
      trainingSessionId: changeSession.id,
      type: NotificationType.REGULAR_SESSION_REMINDER
    }
  });

  assert(
    changedReminderCount === 1,
    "Rescheduling created duplicate reminder notifications"
  );

  await prisma.notification.deleteMany({
    where: { parentId: parent.id }
  });
  await prisma.trainingSession.deleteMany({
    where: {
      id: {
        in: [reminderSession.id, changeSession.id]
      }
    }
  });
  await prisma.telegramContact.delete({
    where: { telegramUserId }
  });
  await prisma.studentEnrollment.delete({
    where: { id: enrollment.id }
  });
  await prisma.child.delete({
    where: { id: child.id }
  });
  await prisma.parent.delete({
    where: { id: parent.id }
  });

  console.log("Regular session notifications smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
