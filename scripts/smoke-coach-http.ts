import "dotenv/config";
import { TrialBookingStatus } from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const username = process.env.COACH_SMOKE_USERNAME;
const password = process.env.COACH_SMOKE_PASSWORD;
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
  if (!username || !password) {
    throw new Error("Coach smoke credentials are not configured");
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

  const logout = await fetch(`${baseUrl}/api/coach/logout`, {
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
