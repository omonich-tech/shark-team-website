import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  EnrollmentStatus,
  LifecycleStatus
} from "@/generated/prisma/client";
import { TrialLeadFlow } from "@/components/public/trial-lead-flow";
import { getPrisma } from "@/lib/prisma";
import { isPublicLocale } from "@/lib/public-i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default async function TrialPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sport?: string; branch?: string }>;
}) {
  const { locale } = await params;
  const requested = await searchParams;

  if (!isPublicLocale(locale)) {
    notFound();
  }

  const prisma = getPrisma();
  const sports = await prisma.sport.findMany({
    where: {
      status: LifecycleStatus.ACTIVE,
      groups: {
        some: {
          status: LifecycleStatus.ACTIVE,
          enrollmentStatus: EnrollmentStatus.OPEN,
          branch: { status: LifecycleStatus.ACTIVE }
        }
      }
    },
    include: {
      groups: {
        where: {
          status: LifecycleStatus.ACTIVE,
          enrollmentStatus: EnrollmentStatus.OPEN,
          branch: { status: LifecycleStatus.ACTIVE }
        },
        include: { branch: true }
      }
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  const choices = sports
    .map((sport) => ({
      slug: sport.slug,
      nameRu: sport.nameRu,
      nameUz: sport.nameUz,
      branches: Array.from(
        new Map(
          sport.groups.map((group) => [
            group.branch.slug,
            {
              slug: group.branch.slug,
              nameRu: group.branch.publicNameRu,
              nameUz: group.branch.publicNameUz
            }
          ])
        ).values()
      ).sort((a, b) =>
        a.slug === requested.branch ? -1 : b.slug === requested.branch ? 1 : 0
      )
    }))
    .sort((a, b) =>
      a.slug === requested.sport ? -1 : b.slug === requested.sport ? 1 : 0
    );

  return (
    <main className="page-main">
      <section className="page-hero compact shark-page-hero">
        <p className="eyebrow">
          {locale === "ru" ? "ПРОБНОЕ ЗАНЯТИЕ" : "SINOV MASHG‘ULOTI"}
        </p>
        <h1>
          {locale === "ru"
            ? "Подберите спорт, филиал и дату пробного"
            : "Sport, filial va sinov sanasini tanlang"}
        </h1>
        <p className="lead">
          {locale === "ru"
            ? "Выберите направление и удобный филиал. Система подберёт группу по возрасту и покажет только доступные будущие тренировки."
            : "Yo‘nalish va qulay filialni tanlang. Tizim yoshga mos guruhni topadi va faqat mavjud kelgusi mashg‘ulotlarni ko‘rsatadi."}
        </p>
      </section>

      <section className="content-section booking-section">
        <TrialLeadFlow locale={locale} choices={choices} />
      </section>
    </main>
  );
}
