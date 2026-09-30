import "dotenv/config";
import {
  NotificationStatus,
  NotificationType,
  PaymentStatus,
  StudentEnrollmentStatus,
  TrialBookingStatus,
  TrialConversionStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const username = process.env.COACH_SMOKE_USERNAME;
const password = process.env.COACH_SMOKE_PASSWORD;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const cronSecret = process.env.CRON_SECRET;
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
const adminUserId = Number(
  (process.env.TELEGRAM_ADMIN_USER_IDS ?? "").split(",")[0]
);
const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function cookieFrom(response: Response) {
  const raw = response.headers.get("set-cookie");
  if (!raw) throw new Error("Coach login did not return a cookie");
  return raw.split(";")[0];
}

async function main() {
  if (
    !username ||
    !password ||
    !webhookSecret ||
    !cronSecret ||
    !adminUsername ||
    !adminPassword ||
    !adminChatId ||
    !Number.isInteger(adminUserId)
  ) {
    throw new Error("Coach/Telegram/Admin smoke configuration is missing");
  }

  const booking = await prisma.trialBooking.findFirst({
    where: {
      status: TrialBookingStatus.CONFIRMED,
      lead: { childName: "Coach Trial Child" }
    },
    include: {
      lead: true,
      session: true
    }
  });

  assert(booking, "Prepared coach trial booking not found");
  assert(booking.lead.childId, "Prepared trial child is missing");

  const unauthenticated = await fetch(`${baseUrl}/coach`, {
    redirect: "manual"
  });

  assert(
    [303, 307, 308].includes(unauthenticated.status),
    `Expected protected coach redirect, got ${unauthenticated.status}`
  );

  const wrong = await fetch(`${baseUrl}/api/coach/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password: `${password}-wrong`
    })
  });

  assert(wrong.status === 401, "Wrong coach password must return 401");

  const login = await fetch(`${baseUrl}/api/coach/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  assert(login.status === 200, "Coach login failed");
  const cookie = cookieFrom(login);
  const headers = { Cookie: cookie };

  const dashboard = await fetch(`${baseUrl}/coach`, { headers });
  const dashboardHtml = await dashboard.text();
  assert(dashboard.ok, "Coach dashboard failed");
  assert(
    dashboardHtml.includes("SHARK TEAM COACH"),
    "Coach dashboard content missing"
  );

  const groups = await fetch(`${baseUrl}/coach/groups`, { headers });
  const groupsHtml = await groups.text();
  assert(groups.ok, "Coach groups page failed");
  assert(
    groupsHtml.includes("Regular Child"),
    "Regular child missing from coach group"
  );

  const session = await fetch(
    `${baseUrl}/coach/sessions/${booking.sessionId}`,
    { headers }
  );
  const sessionHtml = await session.text();
  assert(session.ok, "Coach session page failed");
  assert(
    sessionHtml.includes("Coach Trial Child"),
    "Trial child missing from coach session"
  );
  assert(
    sessionHtml.includes("Regular Child"),
    "Regular child missing from coach session"
  );

  const attendance = await fetch(
    `${baseUrl}/api/coach/sessions/${booking.sessionId}/attendance`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        childId: booking.lead.childId,
        status: "PRESENT"
      })
    }
  );

  const attendancePayload = await attendance.json();

  assert(
    attendance.ok && attendancePayload.ok,
    "Coach attendance marking failed"
  );

  const updatedBooking = await prisma.trialBooking.findUnique({
    where: { id: booking.id }
  });

  assert(
    updatedBooking?.status === TrialBookingStatus.ATTENDED,
    "Present trial must move booking to ATTENDED"
  );

  const assessmentPage = await fetch(
    `${baseUrl}/coach/trials/${booking.id}`,
    { headers }
  );
  const assessmentHtml = await assessmentPage.text();
  assert(assessmentPage.ok, "Trial assessment page failed");
  assert(
    assessmentHtml.includes("Оценка ребёнка"),
    "Assessment form is missing"
  );

  const assessment = await fetch(
    `${baseUrl}/api/coach/trials/${booking.id}/assessment`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ability: 4,
        discipline: 5,
        motivation: 4,
        coordination: 3,
        physicalPreparation: 4,
        psychologicalReadiness: 5,
        coachComment: "CI coach assessment",
        recommendation: "Continue in the group"
      })
    }
  );

  const assessmentPayload = await assessment.json();

  assert(
    assessment.ok && assessmentPayload.ok,
    "Trial assessment save failed"
  );

  const saved = await prisma.trialAssessment.findUnique({
    where: { trialBookingId: booking.id }
  });

  assert(saved?.discipline === 5, "Saved trial assessment is incorrect");
  assert(
    saved?.coachComment === "CI coach assessment",
    "Saved coach comment is incorrect"
  );

  await prisma.notification.upsert({
    where: {
      dedupeKey: "ci:trial-feedback:" + booking.id
    },
    update: {
      type: NotificationType.POST_TRIAL_FEEDBACK,
      leadId: booking.leadId,
      parentId: booking.lead.parentId,
      trialBookingId: booking.id,
      status: NotificationStatus.PENDING,
      scheduledAt: new Date(Date.now() - 1000),
      attempts: 0,
      lastError: null
    },
    create: {
      type: NotificationType.POST_TRIAL_FEEDBACK,
      leadId: booking.leadId,
      parentId: booking.lead.parentId,
      trialBookingId: booking.id,
      status: NotificationStatus.PENDING,
      scheduledAt: new Date(Date.now() - 1000),
      dedupeKey: "ci:trial-feedback:" + booking.id
    }
  });

  const worker = await fetch(`${baseUrl}/api/jobs/notifications`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`
    }
  });
  const workerPayload = await worker.json();

  assert(
    worker.ok && workerPayload.ok,
    "Post-trial feedback notification worker failed"
  );

  const ratingCallback = await fetch(`${baseUrl}/api/telegram/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-bot-api-secret-token": webhookSecret
    },
    body: JSON.stringify({
      update_id: 901,
      callback_query: {
        id: "ci-feedback-rating",
        data: "feedback:5:" + booking.id,
        from: {
          id: 777001,
          username: "ci_parent"
        },
        message: {
          message_id: 30,
          chat: {
            id: 777001,
            type: "private"
          }
        }
      }
    })
  });

  assert(ratingCallback.ok, "Parent feedback rating callback failed");

  const afterRating = await prisma.trialFeedback.findUnique({
    where: { trialBookingId: booking.id }
  });

  assert(afterRating?.rating === 5, "Parent feedback rating was not stored");
  assert(
    !afterRating.completedAt,
    "Feedback must wait for comment or skip after rating"
  );

  const commentWebhook = await fetch(`${baseUrl}/api/telegram/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-bot-api-secret-token": webhookSecret
    },
    body: JSON.stringify({
      update_id: 902,
      message: {
        text: "Очень понравилось занятие и тренер.",
        chat: { id: 777001, type: "private" },
        from: {
          id: 777001,
          username: "ci_parent",
          first_name: "CI Parent",
          language_code: "ru"
        }
      }
    })
  });

  assert(commentWebhook.ok, "Parent feedback comment webhook failed");

  const completedFeedback = await prisma.trialFeedback.findUnique({
    where: { trialBookingId: booking.id }
  });

  assert(
    completedFeedback?.comment === "Очень понравилось занятие и тренер.",
    "Parent feedback comment was not stored"
  );
  assert(completedFeedback.completedAt, "Parent feedback was not completed");
  assert(
    completedFeedback.adminNotifiedAt,
    "Combined trial outcome was not sent to admin"
  );

  const readyConversion = await prisma.trialConversion.findUnique({
    where: { trialBookingId: booking.id }
  });

  assert(readyConversion, "Ready trial conversion was not created");
  assert(
    readyConversion.status === TrialConversionStatus.READY,
    "Completed trial must enter READY conversion state"
  );

  const adminLogin = await fetch(baseUrl + "/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: adminUsername,
      password: adminPassword
    })
  });

  assert(adminLogin.ok, "Admin login for conversion flow failed");
  const adminCookie = cookieFrom(adminLogin);

  const offerResponse = await fetch(
    baseUrl + "/api/admin/trials/" + booking.id + "/conversion",
    {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "offer",
        adminNote: "CI subscription offer"
      })
    }
  );
  const offerPayload = await offerResponse.json();

  assert(
    offerResponse.ok && offerPayload.ok,
    "Subscription offer creation failed"
  );

  const offeredConversion = await prisma.trialConversion.findUnique({
    where: { trialBookingId: booking.id },
    include: { payment: true }
  });

  assert(
    offeredConversion?.status === TrialConversionStatus.OFFERED,
    "Conversion did not move to OFFERED"
  );
  assert(
    offeredConversion.payment?.status === PaymentStatus.PENDING,
    "Subscription payment was not created"
  );
  assert(
    offeredConversion.payment?.amountUzs === 500000,
    "Unexpected subscription amount"
  );

  const subscriptionReceipt = await fetch(
    baseUrl + "/api/telegram/webhook",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": webhookSecret
      },
      body: JSON.stringify({
        update_id: 903,
        message: {
          message_id: 31,
          chat: { id: 777001, type: "private" },
          from: {
            id: 777001,
            username: "ci_parent",
            first_name: "CI Parent",
            language_code: "ru"
          },
          document: {
            file_id: "ci-subscription-receipt",
            file_name: "subscription-receipt.pdf",
            mime_type: "application/pdf",
            file_size: 22000
          }
        }
      })
    }
  );

  assert(subscriptionReceipt.ok, "Subscription receipt webhook failed");

  const underReview = await prisma.subscriptionPayment.findUnique({
    where: {
      trialConversionId: readyConversion.id
    }
  });

  assert(
    underReview?.status === PaymentStatus.UNDER_REVIEW,
    "Subscription receipt did not move payment UNDER_REVIEW"
  );

  const subscriptionCallback = await fetch(
    baseUrl + "/api/telegram/webhook",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": webhookSecret
      },
      body: JSON.stringify({
        update_id: 904,
        callback_query: {
          id: "ci-subscription-approve",
          data: "subscription:approve:" + underReview?.id,
          from: {
            id: adminUserId,
            username: "ci_admin"
          },
          message: {
            message_id: 32,
            chat: {
              id: Number(adminChatId),
              type: "supergroup"
            }
          }
        }
      })
    }
  );

  assert(
    subscriptionCallback.ok,
    "Subscription approval callback failed"
  );

  const enrolledConversion = await prisma.trialConversion.findUnique({
    where: { trialBookingId: booking.id },
    include: {
      payment: true
    }
  });

  assert(
    enrolledConversion?.status === TrialConversionStatus.ENROLLED,
    "Conversion did not move to ENROLLED"
  );
  assert(
    enrolledConversion.payment?.status === PaymentStatus.PAID,
    "Subscription payment was not marked PAID"
  );

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      childId: booking.lead.childId,
      groupId: booking.session.groupId,
      status: StudentEnrollmentStatus.ACTIVE
    }
  });

  assert(enrollment, "Child was not enrolled into the regular group");

  const closedLead = await prisma.lead.findUnique({
    where: { id: booking.leadId }
  });

  assert(
    closedLead?.status === "CLOSED",
    "Converted lead was not closed"
  );

  const logout = await fetch(\`\${baseUrl}/api/coach/logout\`, {
    method: "POST",
    headers
  });

  assert(logout.ok, "Coach logout failed");

  console.log("Coach dashboard HTTP smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
