import { getPrisma } from "@/lib/prisma";
import { getCoachSession } from "@/server/coach/auth";
import { verifyMiniAppInitData } from "@/server/telegram/miniapp-auth";
import { markCoachAttendance } from "@/server/coach/mark-attendance";
import { AttendanceStatus } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function failure(error: string, status = 401) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get("role");
  const prisma = getPrisma();
  const now = new Date();

  if (role === "coach") {
    const coach = await getCoachSession();
    if (!coach) return failure("COACH_LOGIN_REQUIRED");
    const sessions = await prisma.trainingSession.findMany({
      where: { coachId: coach.coachId, startsAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      include: {
        group: { include: { sport: true, branch: true } },
        trialBookings: {
          where: { status: "CONFIRMED" },
          select: { id: true, lead: { select: { childName: true, childAge: true } } }
        }
      },
      orderBy: { startsAt: "asc" },
      take: 24
    });
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const selected = sessions.find(s => s.id === sessionId);
    let participants: Awaited<ReturnType<typeof import("@/server/coach/get-session-participants").getCoachSessionParticipants>> = null;
    if (selected) {
      const { getCoachSessionParticipants } = await import("@/server/coach/get-session-participants");
      participants = await getCoachSessionParticipants(coach.coachId, selected.id);
    }
    return NextResponse.json({
      ok: true, role: "coach", coachName: [coach.coach.firstName, coach.coach.lastName].filter(Boolean).join(" "),
      sessions: sessions.map(s => ({
        id: s.id, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(),
        status: s.status, group: s.group.internalName, sport: s.group.sport.nameRu,
        branch: s.group.branch.publicNameRu, trialBookings: s.trialBookings.map(b => ({
          id: b.id, childName: b.lead.childName, childAge: b.lead.childAge
        }))
      })),
      participants: participants?.participants ?? null
    }, { headers: { "Cache-Control": "no-store" } });
  }

  if (role !== "parent") return failure("INVALID_ROLE", 400);
  const identity = verifyMiniAppInitData(request.headers.get("x-telegram-init-data") ?? "");
  if (!identity) return failure("TELEGRAM_AUTH_REQUIRED");
  const contact = await prisma.telegramContact.findUnique({
    where: { telegramUserId: identity.id }, select: { parentId: true, locale: true, leadId: true }
  });
  if (!contact) return failure("TELEGRAM_NOT_LINKED", 403);

  // Parent identity must be derived from verified Telegram contact, never from client-sent child IDs.
  const parentId = contact.parentId ??
    (contact.leadId ? (await prisma.lead.findUnique({ where: { id: contact.leadId }, select: { parentId: true } }))?.parentId : null);
  if (!parentId) return failure("PARENT_NOT_LINKED", 403);

  const children = await prisma.child.findMany({
    where: { parentId },
    include: {
      enrollments: {
        where: { status: { in: ["ACTIVE", "PAUSED"] } },
        include: {
          group: { include: { sport: true, branch: true, sessions: {
            where: { status: "SCHEDULED", startsAt: { gte: now } },
            orderBy: { startsAt: "asc" }, take: 3
          } } },
          payments: { orderBy: { createdAt: "desc" }, take: 1 }
        }
      },
      attendances: {
        where: { trialBookingId: null, markedAt: { gte: new Date(now.getTime() - 90 * 86400000) } },
        orderBy: { markedAt: "desc" }, take: 40
      },
      progressAssessments: {
        orderBy: { assessedAt: "desc" }, take: 6,
        select: { id: true, assessedAt: true, ability: true, coordination: true, discipline: true,
          motivation: true, physicalPreparation: true, psychologicalReadiness: true, coachComment: true }
      },
      leads: {
        include: {
          trialBookings: {
            orderBy: { createdAt: "desc" }, take: 2,
            include: { session: { include: { group: { include: { sport: true, branch: true } } } },
              assessment: true, feedback: true }
          }
        }
      }
    },
    orderBy: { name: "asc" }
  });

  return NextResponse.json({
    ok: true, role: "parent", locale: contact.locale === "uz" ? "uz" : "ru",
    children: children.map(child => {
      const total = child.attendances.length;
      const present = child.attendances.filter(a => a.status === "PRESENT").length;
      return {
        id: child.id, name: child.name,
        attendance: { present, marked: total, percent: total ? Math.round(100 * present / total) : null },
        enrollments: child.enrollments.map(e => ({
          id: e.id, group: e.group.internalName, sport: e.group.sport.nameRu,
          branch: e.group.branch.publicNameRu, status: e.subscriptionStatus ?? e.status,
          periodEnd: e.currentPeriodEnd?.toISOString() ?? null,
          nextPaymentDue: e.nextPaymentDueAt?.toISOString() ?? null,
          latestPayment: e.payments[0] ? { status: e.payments[0].status, amount: e.payments[0].amountUzs } : null,
          sessions: e.group.sessions.map(s => ({ id: s.id, startsAt: s.startsAt.toISOString() }))
        })),
        progress: child.progressAssessments.map(a => ({
          date: a.assessedAt.toISOString(),
          scores: { ability: a.ability, coordination: a.coordination, discipline: a.discipline,
            motivation: a.motivation, physicalPreparation: a.physicalPreparation,
            psychologicalReadiness: a.psychologicalReadiness },
          comment: a.coachComment
        })),
        trials: child.leads.flatMap(lead => lead.trialBookings.map(b => ({
          id: b.id, status: b.status, startsAt: b.session.startsAt.toISOString(),
          sport: b.session.group.sport.nameRu, branch: b.session.group.branch.publicNameRu,
          assessment: b.assessment ? {
            ability: b.assessment.ability, coordination: b.assessment.coordination,
            discipline: b.assessment.discipline, motivation: b.assessment.motivation
          } : null,
          feedbackRating: b.feedback?.rating ?? null
        })))
      };
    })
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const coach = await getCoachSession();
  if (!coach) return failure("COACH_LOGIN_REQUIRED");
  let body: { sessionId?: string; childId?: string; status?: string };
  try { body = await request.json(); } catch { return failure("INVALID_BODY", 400); }
  if (!body.sessionId || !body.childId ||
    !["PRESENT", "ABSENT", "EXCUSED"].includes(body.status ?? "")) return failure("INVALID_INPUT", 400);
  const result = await markCoachAttendance({
    coachId: coach.coachId,
    sessionId: body.sessionId,
    childId: body.childId,
    status: body.status as AttendanceStatus
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 409, headers: { "Cache-Control": "no-store" } });
}
