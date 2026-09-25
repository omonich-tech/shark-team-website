import { NextResponse } from "next/server";
import {
  LifecycleStatus,
  PriceProductType
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export async function GET() {
  const now = new Date();

  const branch = await prisma.branch.findUnique({
    where: { slug: "school-117" },
    include: {
      sportLinks: {
        where: { status: LifecycleStatus.ACTIVE },
        include: { sport: true }
      },
      groups: {
        where: { status: LifecycleStatus.ACTIVE },
        orderBy: { ageMin: "asc" },
        include: {
          sport: true,
          primaryCoach: true,
          scheduleRules: {
            where: { status: LifecycleStatus.ACTIVE }
          }
        }
      }
    }
  });

  if (!branch || branch.status !== LifecycleStatus.ACTIVE) {
    return NextResponse.json(
      { ok: false, error: "BRANCH_NOT_FOUND" },
      { status: 404 }
    );
  }

  const prices = await prisma.price.findMany({
    where: {
      branchId: branch.id,
      status: LifecycleStatus.ACTIVE,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gt: now } }]
    },
    orderBy: { productType: "asc" }
  });

  return NextResponse.json({
    ok: true,
    branch: {
      id: branch.id,
      slug: branch.slug,
      name: {
        ru: branch.publicNameRu,
        uz: branch.publicNameUz
      },
      district: {
        ru: branch.districtRu,
        uz: branch.districtUz
      },
      address: {
        ru: branch.addressRu,
        uz: branch.addressUz,
        postalCode: branch.postalCode
      },
      landmark: {
        ru: branch.landmarkRu,
        uz: branch.landmarkUz
      },
      coordinates:
        branch.latitude !== null && branch.longitude !== null
          ? {
              latitude: Number(branch.latitude),
              longitude: Number(branch.longitude)
            }
          : null,
      sports: branch.sportLinks.map(({ sport }) => ({
        id: sport.id,
        slug: sport.slug,
        name: {
          ru: sport.nameRu,
          uz: sport.nameUz
        }
      })),
      groups: branch.groups.map((group) => ({
        id: group.id,
        ageMin: group.ageMin,
        ageMax: group.ageMax,
        capacityRegular: group.capacityRegular,
        capacityTrial: group.capacityTrial,
        enrollmentStatus: group.enrollmentStatus,
        sport: {
          id: group.sport.id,
          slug: group.sport.slug,
          name: {
            ru: group.sport.nameRu,
            uz: group.sport.nameUz
          }
        },
        coach: {
          id: group.primaryCoach.id,
          firstName: group.primaryCoach.firstName,
          lastName: group.primaryCoach.lastName
        },
        schedule: group.scheduleRules.map((rule) => ({
          weekday: rule.weekday,
          start: formatMinutes(rule.startMinutes),
          end: formatMinutes(rule.endMinutes)
        }))
      })),
      prices: {
        trial:
          prices.find(
            (price) => price.productType === PriceProductType.TRIAL
          ) ?? null,
        subscription:
          prices.find(
            (price) => price.productType === PriceProductType.SUBSCRIPTION
          ) ?? null
      }
    }
  });
}
