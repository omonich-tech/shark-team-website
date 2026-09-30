import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

function clean(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ childId: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { childId } = await context.params;
  const body = await request.json();
  const prisma = getPrisma();

  const child = await prisma.child.findUnique({
    where: { id: childId },
    include: { parent: true }
  });

  if (!child) {
    return NextResponse.json({ ok: false, error: "CHILD_NOT_FOUND" }, { status: 404 });
  }

  const childName = clean(body.childName);
  const parentName = clean(body.parentName);
  const parentPhone = clean(body.parentPhone, 40);
  const locale = clean(body.locale, 5).toLowerCase();
  const ageAtRegistration = Number(body.ageAtRegistration);
  const dateOfBirth =
    typeof body.dateOfBirth === "string" && body.dateOfBirth
      ? new Date(body.dateOfBirth + "T00:00:00.000Z")
      : null;

  if (
    childName.length < 2 ||
    parentName.length < 2 ||
    parentPhone.length < 5 ||
    !Number.isInteger(ageAtRegistration) ||
    ageAtRegistration < 3 ||
    ageAtRegistration > 19 ||
    !["ru", "uz"].includes(locale) ||
    (dateOfBirth && Number.isNaN(dateOfBirth.getTime()))
  ) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const parent = await tx.parent.update({
        where: { id: child.parentId },
        data: {
          name: parentName,
          phone: parentPhone,
          locale
        }
      });

      const nextChild = await tx.child.update({
        where: { id: child.id },
        data: {
          name: childName,
          ageAtRegistration,
          dateOfBirth
        }
      });

      return { child: nextChild, parent };
    });

    await writeAdminAudit({
      actorId: admin.sub,
      action: "UPDATE_STUDENT_PROFILE",
      entityType: "Child",
      entityId: child.id,
      before: {
        child: {
          name: child.name,
          ageAtRegistration: child.ageAtRegistration,
          dateOfBirth: child.dateOfBirth
        },
        parent: {
          name: child.parent.name,
          phone: child.parent.phone,
          locale: child.parent.locale
        }
      },
      after: updated
    });

    return NextResponse.json({ ok: true, ...updated });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { ok: false, error: "PHONE_ALREADY_USED" },
        { status: 409 }
      );
    }
    throw error;
  }
}
