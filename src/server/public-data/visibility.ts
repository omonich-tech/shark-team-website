import {
  EnrollmentStatus,
  LifecycleStatus
} from "@/generated/prisma/client";

export const PUBLIC_BRANCH_WHERE = {
  status: LifecycleStatus.ACTIVE
} as const;

export const PUBLIC_SPORT_WHERE = {
  status: LifecycleStatus.ACTIVE
} as const;

export const PUBLIC_COACH_WHERE = {
  status: LifecycleStatus.ACTIVE
} as const;

export const PUBLIC_BRANCH_SPORT_LINK_WHERE = {
  status: LifecycleStatus.ACTIVE,
  branch: { status: LifecycleStatus.ACTIVE },
  sport: { status: LifecycleStatus.ACTIVE }
} as const;

export const PUBLIC_COACH_BRANCH_LINK_WHERE = {
  status: LifecycleStatus.ACTIVE,
  coach: { status: LifecycleStatus.ACTIVE },
  branch: { status: LifecycleStatus.ACTIVE }
} as const;

export const PUBLIC_COACH_SPORT_LINK_WHERE = {
  status: LifecycleStatus.ACTIVE,
  coach: { status: LifecycleStatus.ACTIVE },
  sport: { status: LifecycleStatus.ACTIVE }
} as const;

export const PUBLIC_GROUP_WHERE = {
  status: LifecycleStatus.ACTIVE,
  branch: { status: LifecycleStatus.ACTIVE },
  sport: { status: LifecycleStatus.ACTIVE },
  primaryCoach: { status: LifecycleStatus.ACTIVE }
} as const;

export const BOOKABLE_GROUP_WHERE = {
  ...PUBLIC_GROUP_WHERE,
  enrollmentStatus: EnrollmentStatus.OPEN
} as const;
