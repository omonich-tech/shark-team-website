import { getPrisma } from "@/lib/prisma";

const ID_RE = /^[A-Za-z0-9_-]{8,80}$/;

function cleanId(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return ID_RE.test(text) ? text : null;
}

export async function recordLeadFunnelEvent(input: {
  leadId: string;
  eventName: string;
  bookingId?: string | null;
  paymentId?: string | null;
  dedupeKey: string;
}) {
  const prisma = getPrisma();
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: {
      analyticsVisitorId: true,
      analyticsSessionId: true,
      analyticsPageViewId: true,
      landingPage: true,
      sport: { select: { slug: true } },
      branch: { select: { slug: true } }
    }
  });

  const visitorId = cleanId(lead?.analyticsVisitorId);
  const sessionId = cleanId(lead?.analyticsSessionId);
  if (!lead || !visitorId || !sessionId) return;

  await prisma.webFunnelEvent.upsert({
    where: { dedupeKey: input.dedupeKey },
    update: {},
    create: {
      visitorId,
      sessionId,
      pageViewId: cleanId(lead.analyticsPageViewId),
      eventName: input.eventName,
      path: lead.landingPage,
      sportSlug: lead.sport?.slug ?? null,
      branchSlug: lead.branch?.slug ?? null,
      leadId: input.leadId,
      bookingId: input.bookingId ?? null,
      paymentId: input.paymentId ?? null,
      dedupeKey: input.dedupeKey
    }
  });
}
