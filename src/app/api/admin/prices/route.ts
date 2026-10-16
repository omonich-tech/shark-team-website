import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  LifecycleStatus,
  PriceProductType
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const productType = String(body.productType ?? "") as PriceProductType;
  const amount = Number(body.amount);
  const branchId =
    typeof body.branchId === "string" && body.branchId ? body.branchId : null;
  const sportId =
    typeof body.sportId === "string" && body.sportId ? body.sportId : null;
  const groupId =
    typeof body.groupId === "string" && body.groupId ? body.groupId : null;

  if (!Object.values(PriceProductType).includes(productType)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PRODUCT_TYPE" },
      { status: 400 }
    );
  }

  if (!Number.isInteger(amount) || amount < 0 || amount > 100_000_000) {
    return NextResponse.json(
      { ok: false, error: "INVALID_AMOUNT" },
      { status: 400 }
    );
  }

  if (!branchId && !sportId && !groupId) {
    return NextResponse.json(
      { ok: false, error: "PRICE_SCOPE_REQUIRED" },
      { status: 400 }
    );
  }

  const prisma = getPrisma();
  const now = new Date();

  const before = await prisma.price.findMany({
    where: {
      productType,
      branchId,
      sportId,
      groupId,
      status: LifecycleStatus.ACTIVE,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gt: now } }]
    },
    orderBy: { validFrom: "desc" }
  });

  const after = await prisma.$transaction(async (tx) => {
    await tx.price.updateMany({
      where: {
        productType,
        branchId,
        sportId,
        groupId,
        status: LifecycleStatus.ACTIVE,
        OR: [{ validTo: null }, { validTo: { gt: now } }]
      },
      data: {
        validTo: now
      }
    });

    return tx.price.create({
      data: {
        id: `PRICE-${randomUUID()}`,
        productType,
        amount,
        currency: "UZS",
        branchId,
        sportId,
        groupId,
        validFrom: now,
        status: LifecycleStatus.ACTIVE
      }
    });
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "CREATE_VERSION",
    entityType: "Price",
    entityId: after.id,
    before,
    after
  });

  const [branch, sport] = await Promise.all([
    branchId
      ? prisma.branch.findUnique({
          where: { id: branchId },
          select: { slug: true }
        })
      : Promise.resolve(null),
    sportId
      ? prisma.sport.findUnique({
          where: { id: sportId },
          select: { slug: true }
        })
      : Promise.resolve(null)
  ]);

  revalidatePath("/ru/prices");
  revalidatePath("/uz/prices");

  if (branch) {
    revalidatePath(`/ru/branches/${branch.slug}`);
    revalidatePath(`/uz/branches/${branch.slug}`);
  }

  if (sport) {
    revalidatePath(`/ru/sports/${sport.slug}`);
    revalidatePath(`/uz/sports/${sport.slug}`);
  }

  return NextResponse.json(
    { ok: true, price: after },
    { status: 201 }
  );
}
