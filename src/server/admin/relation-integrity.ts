import {
  LifecycleStatus,
  type PrismaClient
} from "@/generated/prisma/client";

const GROUP_DEPENDENCY_STATUS = {
  not: LifecycleStatus.ARCHIVED
} as const;

export async function findBranchSportGroupBlockers(
  prisma: PrismaClient,
  branchId: string,
  allowedSportIds: string[]
) {
  return prisma.trainingGroup.findMany({
    where: {
      branchId,
      status: GROUP_DEPENDENCY_STATUS,
      ...(allowedSportIds.length
        ? { sportId: { notIn: allowedSportIds } }
        : {})
    },
    select: {
      id: true,
      internalName: true,
      sportId: true
    },
    orderBy: { createdAt: "asc" },
    take: 20
  });
}

export async function findBranchCoachGroupBlockers(
  prisma: PrismaClient,
  branchId: string,
  allowedCoachIds: string[]
) {
  return prisma.trainingGroup.findMany({
    where: {
      branchId,
      status: GROUP_DEPENDENCY_STATUS,
      ...(allowedCoachIds.length
        ? { primaryCoachId: { notIn: allowedCoachIds } }
        : {})
    },
    select: {
      id: true,
      internalName: true,
      primaryCoachId: true
    },
    orderBy: { createdAt: "asc" },
    take: 20
  });
}

export async function findCoachSportGroupBlockers(
  prisma: PrismaClient,
  coachId: string,
  allowedSportIds: string[]
) {
  return prisma.trainingGroup.findMany({
    where: {
      primaryCoachId: coachId,
      status: GROUP_DEPENDENCY_STATUS,
      ...(allowedSportIds.length
        ? { sportId: { notIn: allowedSportIds } }
        : {})
    },
    select: {
      id: true,
      internalName: true,
      sportId: true
    },
    orderBy: { createdAt: "asc" },
    take: 20
  });
}

export async function findCoachBranchGroupBlockers(
  prisma: PrismaClient,
  coachId: string,
  allowedBranchIds: string[]
) {
  return prisma.trainingGroup.findMany({
    where: {
      primaryCoachId: coachId,
      status: GROUP_DEPENDENCY_STATUS,
      ...(allowedBranchIds.length
        ? { branchId: { notIn: allowedBranchIds } }
        : {})
    },
    select: {
      id: true,
      internalName: true,
      branchId: true
    },
    orderBy: { createdAt: "asc" },
    take: 20
  });
}

export async function countActiveGroups(
  prisma: PrismaClient,
  scope: {
    branchId?: string;
    sportId?: string;
    primaryCoachId?: string;
  }
) {
  return prisma.trainingGroup.count({
    where: {
      status: LifecycleStatus.ACTIVE,
      ...scope
    }
  });
}

export async function hasActiveBranchSport(
  prisma: PrismaClient,
  branchId: string,
  sportId: string
) {
  const relation = await prisma.branchSport.findUnique({
    where: {
      branchId_sportId: { branchId, sportId }
    },
    select: { status: true }
  });

  return relation?.status === LifecycleStatus.ACTIVE;
}
