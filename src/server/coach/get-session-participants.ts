import {
  StudentEnrollmentStatus,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

export async function getCoachSessionParticipants(
  coachId: string,
  sessionId: string
) {
  const prisma = getPrisma();

  const session = await prisma.trainingSession.findFirst({
    where: {
      id: sessionId,
      coachId
    },
    include: {
      group: {
        include: {
          branch: true,
          sport: true,
          enrollments: {
            where: {
              status: StudentEnrollmentStatus.ACTIVE
            },
            include: {
              child: {
                include: {
                  parent: true
                }
              }
            }
          }
        }
      },
      trialBookings: {
        where: {
          status: {
            in: [
              TrialBookingStatus.CONFIRMED,
              TrialBookingStatus.ATTENDED,
              TrialBookingStatus.NO_SHOW
            ]
          },
          lead: {
            childId: {
              not: null
            }
          }
        },
        include: {
          lead: {
            include: {
              child: {
                include: {
                  parent: true
                }
              }
            }
          },
          assessment: true
        }
      },
      attendances: true
    }
  });

  if (!session) {
    return null;
  }

  const attendanceByChild = new Map(
    session.attendances.map((attendance) => [
      attendance.childId,
      attendance
    ])
  );

  const participants = new Map<
    string,
    {
      childId: string;
      childName: string;
      parentName: string;
      parentPhone: string;
      source: "REGULAR" | "TRIAL";
      trialBookingId: string | null;
      attendanceStatus: string | null;
      assessmentCompleted: boolean;
    }
  >();

  for (const enrollment of session.group.enrollments) {
    if (enrollment.startDate > session.startsAt) {
      continue;
    }

    if (enrollment.endDate && enrollment.endDate < session.startsAt) {
      continue;
    }

    const child = enrollment.child;
    const attendance = attendanceByChild.get(child.id);

    participants.set(child.id, {
      childId: child.id,
      childName: child.name,
      parentName: child.parent.name,
      parentPhone: child.parent.phone,
      source: "REGULAR",
      trialBookingId: null,
      attendanceStatus: attendance?.status ?? null,
      assessmentCompleted: false
    });
  }

  for (const booking of session.trialBookings) {
    const child = booking.lead.child;

    if (!child) {
      continue;
    }

    const attendance = attendanceByChild.get(child.id);

    participants.set(child.id, {
      childId: child.id,
      childName: child.name,
      parentName: child.parent.name,
      parentPhone: child.parent.phone,
      source: "TRIAL",
      trialBookingId: booking.id,
      attendanceStatus: attendance?.status ?? null,
      assessmentCompleted: Boolean(booking.assessment)
    });
  }

  return {
    session: {
      id: session.id,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      status: session.status,
      groupId: session.groupId,
      groupAgeMin: session.group.ageMin,
      groupAgeMax: session.group.ageMax,
      branchName: session.group.branch.publicNameRu,
      sportName: session.group.sport.nameRu
    },
    participants: Array.from(participants.values()).sort((a, b) =>
      a.childName.localeCompare(b.childName, "ru")
    )
  };
}
