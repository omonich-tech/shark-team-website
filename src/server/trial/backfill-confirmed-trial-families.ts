import { TrialBookingStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

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
      lead: true
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
    });

    repaired += 1;
  }

  return repaired;
}
