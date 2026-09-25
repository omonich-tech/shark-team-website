import {
  LeadStatus,
  LifecycleStatus,
  SessionStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

export type CreateWebsiteLeadInput = {
  parentName: string;
  childName: string;
  phone: string;
  childAge: number;
  locale: "ru" | "uz";
  selectedSessionId: string;
  landingPage?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
};

function cleanText(value: string, maxLength = 120) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function optionalText(value: string | null | undefined, maxLength = 200) {
  if (!value) return null;
  const cleaned = cleanText(value, maxLength);
  return cleaned || null;
}

export function normalizeUzbekPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 9) {
    return `+998${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("998")) {
    return `+${digits}`;
  }

  return null;
}

export async function createWebsiteLead(input: CreateWebsiteLeadInput) {
  const parentName = cleanText(input.parentName, 80);
  const childName = cleanText(input.childName, 80);
  const phone = normalizeUzbekPhone(input.phone);

  if (parentName.length < 2 || childName.length < 2) {
    return { ok: false as const, error: "INVALID_NAME" as const };
  }

  if (!phone) {
    return { ok: false as const, error: "INVALID_PHONE" as const };
  }

  if (
    !Number.isInteger(input.childAge) ||
    input.childAge < 6 ||
    input.childAge > 17
  ) {
    return { ok: false as const, error: "INVALID_AGE" as const };
  }

  const prisma = getPrisma();

  const session = await prisma.trainingSession.findFirst({
    where: {
      id: input.selectedSessionId,
      status: SessionStatus.SCHEDULED,
      startsAt: { gt: new Date() },
      trialBookingEnabled: true,
      trialCapacity: { gt: 0 },
      group: {
        status: LifecycleStatus.ACTIVE,
        ageMin: { lte: input.childAge },
        ageMax: { gte: input.childAge },
        branch: {
          slug: "school-117",
          status: LifecycleStatus.ACTIVE
        },
        sport: {
          slug: "basketball",
          status: LifecycleStatus.ACTIVE
        }
      }
    },
    include: {
      group: true
    }
  });

  if (!session) {
    return { ok: false as const, error: "SESSION_NOT_AVAILABLE" as const };
  }

  const lead = await prisma.lead.create({
    data: {
      status: LeadStatus.TRIAL_SELECTED,
      parentName,
      childName,
      phone,
      childAge: input.childAge,
      locale: input.locale,
      source: "website",
      branchId: session.group.branchId,
      sportId: session.group.sportId,
      groupId: session.groupId,
      selectedSessionId: session.id,
      landingPage: optionalText(input.landingPage, 250),
      utmSource: optionalText(input.utmSource, 120),
      utmMedium: optionalText(input.utmMedium, 120),
      utmCampaign: optionalText(input.utmCampaign, 160),
      utmContent: optionalText(input.utmContent, 160)
    }
  });

  return {
    ok: true as const,
    lead: {
      id: lead.id,
      status: lead.status,
      selectedSessionId: lead.selectedSessionId
    }
  };
}
