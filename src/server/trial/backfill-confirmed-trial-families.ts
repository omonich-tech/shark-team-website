import {
  NotificationStatus,
  NotificationType,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

function envMinutes(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export async function backfillConfirmedTrialFamilies(limit = 200) {
  const prisma = getPrisma();

  const bookings = await prisma.trialBooking.findMany({
    where: {
      status: {
        in: [
          TrialBookingStatus.CONFIRMED,
          TrialBookingStatus.ATTENDED,
          TrialBookingStatus.NO_SHOW
        ]
      },
      lead: {
        OR: [{ parentId: null }, { childId: null }]
      }
    },
    include: {
      lead: true,
      session: true
    },
    orderBy: {
      updatedAt: "asc"
    },
    take: limit
  });

  let repaired = 0;

  for (const booking of bookings) {
    const lead = booking.lead;

    await prisma.$transaction(async (tx) => {
      const parent = await tx.parent.upsert({
        where: { phone: lead.phone },
        update: {
          name: lead.parentName,
          locale: lead.locale
        },
        create: {
          name: lead.parentName,
          phone: lead.phone,
          locale: lead.locale
        }
      });

      let childId = lead.childId;

      if (!childId) {
        const existingChild = await tx.child.findFirst({
          where: {
            parentId: parent.id,
            name: lead.childName
          },
          orderBy: {
            createdAt: "asc"
          }
        });

        childId = existingChild
          ? existingChild.id
          : (
              await tx.child.create({
                data: {
                  parentId: parent.id,
                  name: lead.childName,
                  ageAtRegistration: lead.childAge
                }
              })
            ).id;
      }

      await tx.lead.update({
        where: { id: lead.id },
        data: {
          parentId: parent.id,
          childId
        }
      });

      await tx.telegramContact.updateMany({
        where: { leadId: lead.id },
        data: { parentId: parent.id }
      });

      const now = new Date();
      const reminderMinutes = envMinutes("TRIAL_REMINDER_MINUTES", 180);
      const feedbackMinutes = envMinutes("POST_TRIAL_FEEDBACK_MINUTES", 30);
      const reminderAtRaw = new Date(
        booking.session.startsAt.getTime() - reminderMinutes * 60_000
      );
      const reminderAt = reminderAtRaw > now ? reminderAtRaw : now;
      const feedbackAt = new Date(
        booking.session.endsAt.getTime() + feedbackMinutes * 60_000
      );

      if (booking.session.startsAt > now) {
        await tx.notification.upsert({
          where: {
            dedupeKey: "trial:" + booking.id + ":reminder"
          },
          update: {
            leadId: lead.id,
            parentId: parent.id,
            scheduledAt: reminderAt,
            status: NotificationStatus.PENDING,
            lastError: null
          },
          create: {
            type: NotificationType.TRIAL_REMINDER,
            leadId: lead.id,
            parentId: parent.id,
            trialBookingId: booking.id,
            scheduledAt: reminderAt,
            dedupeKey: "trial:" + booking.id + ":reminder"
          }
        });
      }

      if (booking.status !== TrialBookingStatus.NO_SHOW) {
        await tx.notification.upsert({
          where: {
            dedupeKey: "trial:" + booking.id + ":feedback"
          },
          update: {
            leadId: lead.id,
            parentId: parent.id,
            scheduledAt: feedbackAt,
            status: NotificationStatus.PENDING,
            lastError: null
          },
          create: {
            type: NotificationType.POST_TRIAL_FEEDBACK,
            leadId: lead.id,
            parentId: parent.id,
            trialBookingId: booking.id,
            scheduledAt: feedbackAt,
            dedupeKey: "trial:" + booking.id + ":feedback"
          }
        });
      }
    });

    repaired += 1;
  }

  return repaired;
}
