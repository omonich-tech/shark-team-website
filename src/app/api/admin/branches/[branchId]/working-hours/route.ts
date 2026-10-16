import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { Weekday } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

const ORDERED_DAYS: Array<{ value: Weekday; ru: string; uz: string }> = [
  { value: Weekday.MONDAY, ru: "Пн", uz: "Du" },
  { value: Weekday.TUESDAY, ru: "Вт", uz: "Se" },
  { value: Weekday.WEDNESDAY, ru: "Ср", uz: "Chor" },
  { value: Weekday.THURSDAY, ru: "Чт", uz: "Pay" },
  { value: Weekday.FRIDAY, ru: "Пт", uz: "Ju" },
  { value: Weekday.SATURDAY, ru: "Сб", uz: "Shan" },
  { value: Weekday.SUNDAY, ru: "Вс", uz: "Yak" }
];

function validTime(value: unknown) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ branchId: string }> }
) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { branchId } = await context.params;
  const body = await request.json();
  const rawDays: unknown = body.days;
  const start: unknown = body.start;
  const end: unknown = body.end;

  if (!Array.isArray(rawDays) || !validTime(start) || !validTime(end)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_WORKING_HOURS" },
      { status: 400 }
    );
  }

  if (String(start) >= String(end)) {
    return NextResponse.json(
      { ok: false, error: "WORKING_HOURS_RANGE_INVALID" },
      { status: 400 }
    );
  }

  const allowed = new Set(ORDERED_DAYS.map((day) => day.value));
  const days = Array.from(
    new Set(
      rawDays.filter(
        (value): value is Weekday =>
          typeof value === "string" && allowed.has(value as Weekday)
      )
    )
  );

  if (days.length !== rawDays.length || days.length === 0) {
    return NextResponse.json(
      { ok: false, error: "WORKING_DAYS_REQUIRED" },
      { status: 400 }
    );
  }

  const ordered = ORDERED_DAYS.filter((day) => days.includes(day.value));
  const workingHoursRu = `${ordered.map((day) => day.ru).join(" · ")}, ${start}–${end}`;
  const workingHoursUz = `${ordered.map((day) => day.uz).join(" · ")}, ${start}–${end}`;

  const prisma = getPrisma();
  const before = await prisma.branch.findUnique({ where: { id: branchId } });

  if (!before) {
    return NextResponse.json(
      { ok: false, error: "BRANCH_NOT_FOUND" },
      { status: 404 }
    );
  }

  const after = await prisma.branch.update({
    where: { id: branchId },
    data: { workingHoursRu, workingHoursUz }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "UPDATE_WORKING_HOURS",
    entityType: "Branch",
    entityId: branchId,
    before: {
      workingHoursRu: before.workingHoursRu,
      workingHoursUz: before.workingHoursUz
    },
    after: {
      workingHoursRu: after.workingHoursRu,
      workingHoursUz: after.workingHoursUz
    }
  });

  for (const locale of ["ru", "uz"]) {
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/branches`);
    revalidatePath(`/${locale}/branches/${after.slug}`);
    revalidatePath(`/${locale}/sports`);
  }

  const linkedSports = await prisma.branchSport.findMany({
    where: { branchId, status: "ACTIVE" },
    include: { sport: { select: { slug: true } } }
  });

  for (const link of linkedSports) {
    revalidatePath(`/ru/sports/${link.sport.slug}`);
    revalidatePath(`/uz/sports/${link.sport.slug}`);
  }

  return NextResponse.json({
    ok: true,
    workingHours: { ru: workingHoursRu, uz: workingHoursUz }
  });
}
