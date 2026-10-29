import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  ContentStatus,
  LifecycleStatus,
  PrismaClient
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function relationKey(left: string, right: string) {
  return `${left}:${right}`;
}

async function main() {
  const [
    groups,
    branchSports,
    coachSports,
    coachBranches,
    activePrices,
    publishedFaqs
  ] = await Promise.all([
    prisma.trainingGroup.findMany({
      where: {
        status: { not: LifecycleStatus.ARCHIVED }
      },
      include: {
        branch: true,
        sport: true,
        primaryCoach: true,
        scheduleRules: {
          where: { status: LifecycleStatus.ACTIVE },
          select: { id: true }
        }
      }
    }),
    prisma.branchSport.findMany({
      where: { status: LifecycleStatus.ACTIVE },
      select: { branchId: true, sportId: true }
    }),
    prisma.coachSport.findMany({
      where: { status: LifecycleStatus.ACTIVE },
      select: { coachId: true, sportId: true }
    }),
    prisma.coachBranch.findMany({
      where: { status: LifecycleStatus.ACTIVE },
      select: { coachId: true, branchId: true }
    }),
    prisma.price.findMany({
      where: { status: LifecycleStatus.ACTIVE },
      select: {
        id: true,
        branchId: true,
        sportId: true,
        groupId: true
      }
    }),
    prisma.faqItem.findMany({
      where: { status: ContentStatus.PUBLISHED },
      select: {
        id: true,
        branchId: true,
        sportId: true
      }
    })
  ]);

  const activeBranchSports = new Set(
    branchSports.map((item) => relationKey(item.branchId, item.sportId))
  );
  const activeCoachSports = new Set(
    coachSports.map((item) => relationKey(item.coachId, item.sportId))
  );
  const activeCoachBranches = new Set(
    coachBranches.map((item) => relationKey(item.coachId, item.branchId))
  );
  const groupsById = new Map(groups.map((group) => [group.id, group]));

  for (const group of groups) {
    assert(
      activeBranchSports.has(relationKey(group.branchId, group.sportId)),
      `Group ${group.id} has no ACTIVE BranchSport relation`
    );
    assert(
      activeCoachSports.has(relationKey(group.primaryCoachId, group.sportId)),
      `Group ${group.id} has no ACTIVE CoachSport relation`
    );
    assert(
      activeCoachBranches.has(
        relationKey(group.primaryCoachId, group.branchId)
      ),
      `Group ${group.id} has no ACTIVE CoachBranch relation`
    );

    if (group.status === LifecycleStatus.ACTIVE) {
      assert(
        group.branch.status === LifecycleStatus.ACTIVE,
        `Active group ${group.id} points to a non-active branch`
      );
      assert(
        group.sport.status === LifecycleStatus.ACTIVE,
        `Active group ${group.id} points to a non-active sport`
      );
      assert(
        group.primaryCoach.status === LifecycleStatus.ACTIVE,
        `Active group ${group.id} points to a non-active coach`
      );
      assert(
        group.scheduleRules.length > 0,
        `Active group ${group.id} has no ACTIVE schedule rules`
      );
    }
  }

  for (const price of activePrices) {
    if (price.groupId) {
      const group = groupsById.get(price.groupId);
      assert(
        group,
        `Active price ${price.id} points to an archived or missing group`
      );
      if (price.branchId) {
        assert(
          price.branchId === group.branchId,
          `Active price ${price.id} branch does not match its group`
        );
      }
      if (price.sportId) {
        assert(
          price.sportId === group.sportId,
          `Active price ${price.id} sport does not match its group`
        );
      }
    }

    if (price.branchId && price.sportId) {
      assert(
        activeBranchSports.has(relationKey(price.branchId, price.sportId)),
        `Active price ${price.id} uses an inactive BranchSport relation`
      );
    }
  }

  for (const faq of publishedFaqs) {
    if (faq.branchId && faq.sportId) {
      assert(
        activeBranchSports.has(relationKey(faq.branchId, faq.sportId)),
        `Published FAQ ${faq.id} uses an inactive BranchSport relation`
      );
    }
  }

  console.log(
    `Relation integrity verification passed: ${groups.length} groups checked.`
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
