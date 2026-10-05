import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { isPublicLocale } from "@/lib/public-i18n";
import { tryGetPublishedContentPage } from "@/server/public-data/content-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isPublicLocale(locale)) return {};

  const page = await tryGetPublishedContentPage("contacts");
  if (!page) return {};

  return {
    title:
      (locale === "ru"
        ? page.content.seoTitleRu
        : page.content.seoTitleUz) ??
      (locale === "ru" ? "Контакты SHARK TEAM" : "SHARK TEAM kontaktlari"),
    description:
      (locale === "ru"
        ? page.content.seoDescriptionRu
        : page.content.seoDescriptionUz) ??
      (locale === "ru"
        ? page.content.heroLeadRu
        : page.content.heroLeadUz) ??
      undefined
  };
}

export default async function ContactsPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isPublicLocale(locale)) notFound();

  const prisma = getPrisma();
  const [page, branches] = await Promise.all([
    tryGetPublishedContentPage("contacts"),
    prisma.branch.findMany({
      where: {
        status: LifecycleStatus.ACTIVE,
        groups: { some: { status: LifecycleStatus.ACTIVE } }
      },
      include: {
        groups: {
          where: { status: LifecycleStatus.ACTIVE },
          include: { sport: true }
        }
      },
      orderBy: { createdAt: "asc" }
    })
  ]);

  if (!page) notFound();

  const heroImage =
    page.media.find(
      (item) => item.isPrimary && item.contentType?.startsWith("image/")
    ) ??
    page.media.find((item) => item.contentType?.startsWith("image/")) ??
    null;

  const content = page.content;
  const eyebrow =
    (locale === "ru" ? content.heroEyebrowRu : content.heroEyebrowUz) ??
    "SHARK TEAM";
  const title =
    (locale === "ru" ? content.heroTitleRu : content.heroTitleUz) ??
    (locale === "ru" ? "Контакты" : "Kontaktlar");
  const lead =
    (locale === "ru" ? content.heroLeadRu : content.heroLeadUz) ?? "";
  const body = (locale === "ru" ? content.bodyRu : content.bodyUz) ?? "";
  const hours =
    (locale === "ru" ? content.contactHoursRu : content.contactHoursUz) ?? null;

  const channels = [
    content.contactPhone
      ? {
          label: locale === "ru" ? "Телефон" : "Telefon",
          value: content.contactPhone,
          href: `tel:${content.contactPhone.replace(/[^+\d]/g, "")}`
        }
      : null,
    content.contactTelegram
      ? {
          label: "Telegram",
          value: locale === "ru" ? "Написать в Telegram" : "Telegram orqali yozish",
          href: content.contactTelegram
        }
      : null,
    content.contactInstagram
      ? {
          label: "Instagram",
          value: locale === "ru" ? "Открыть Instagram" : "Instagramni ochish",
          href: content.contactInstagram
        }
      : null,
    content.contactEmail
      ? {
          label: "Email",
          value: content.contactEmail,
          href: `mailto:${content.contactEmail}`
        }
      : null
  ].filter(Boolean) as Array<{ label: string; value: string; href: string }>;

  return (
    <main className="page-main">
      <section className="contacts-hero">
        <div className="contacts-hero-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="lead">{lead}</p>
          {body ? <p className="contacts-intro">{body}</p> : null}
        </div>
        <div
          className={heroImage ? "contacts-hero-media has-photo" : "contacts-hero-media"}
          style={
            heroImage
              ? { backgroundImage: `url("${heroImage.url}")` }
              : undefined
          }
          role={heroImage ? "img" : undefined}
          aria-label={
            heroImage
              ? (locale === "ru" ? heroImage.altRu : heroImage.altUz) ??
                "SHARK TEAM"
              : undefined
          }
        >
          <span>CONTACT</span>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">
            {locale === "ru" ? "СВЯЗАТЬСЯ" : "BOG‘LANISH"}
          </p>
          <h2>
            {locale === "ru"
              ? "Выберите удобный канал"
              : "Qulay aloqa kanalini tanlang"}
          </h2>
        </div>

        {channels.length > 0 ? (
          <div className="contact-channel-grid">
            {channels.map((channel) => (
              <a
                className="contact-channel-card"
                href={channel.href}
                key={channel.label}
                target={channel.href.startsWith("http") ? "_blank" : undefined}
                rel={channel.href.startsWith("http") ? "noreferrer" : undefined}
              >
                <span>{channel.label}</span>
                <strong>{channel.value}</strong>
                <b aria-hidden="true">→</b>
              </a>
            ))}
          </div>
        ) : (
          <div className="shark-coming-soon">
            <p>
              {locale === "ru"
                ? "Общие контакты пока не заполнены. Их можно добавить в админке → Контент."
                : "Umumiy kontaktlar hali kiritilmagan. Ularni admin panel → Kontent orqali qo‘shish mumkin."}
            </p>
          </div>
        )}

        {hours ? (
          <p className="contact-hours">
            <strong>{locale === "ru" ? "Часы связи:" : "Aloqa vaqti:"}</strong>{" "}
            {hours}
          </p>
        ) : null}
      </section>

      <section className="content-section">
        <div className="section-heading shark-section-heading">
          <div>
            <p className="eyebrow">
              {locale === "ru" ? "ФИЛИАЛЫ" : "FILIALlar"}
            </p>
            <h2>
              {locale === "ru"
                ? "Активные локации SHARK TEAM"
                : "Faol SHARK TEAM manzillari"}
            </h2>
          </div>
          <Link className="shark-text-link" href={`/${locale}/branches`}>
            {locale === "ru" ? "Все филиалы →" : "Barcha filiallar →"}
          </Link>
        </div>

        <div className="contact-branch-list">
          {branches.map((branch) => {
            const sports = Array.from(
              new Set(
                branch.groups.map((group) =>
                  locale === "ru" ? group.sport.nameRu : group.sport.nameUz
                )
              )
            ).join(" · ");

            return (
              <article className="contact-branch-card" key={branch.id}>
                <div>
                  <span>
                    {locale === "ru" ? branch.districtRu : branch.districtUz}
                  </span>
                  <h3>
                    {locale === "ru"
                      ? branch.publicNameRu
                      : branch.publicNameUz}
                  </h3>
                  <p>
                    {locale === "ru" ? branch.addressRu : branch.addressUz}
                  </p>
                  {sports ? <small>{sports}</small> : null}
                </div>

                <div className="contact-branch-meta">
                  {branch.publicPhone ? (
                    <a href={`tel:${branch.publicPhone.replace(/[^+\d]/g, "")}`}>
                      {branch.publicPhone}
                    </a>
                  ) : null}
                  {(locale === "ru"
                    ? branch.workingHoursRu
                    : branch.workingHoursUz) ? (
                    <span>
                      {locale === "ru"
                        ? branch.workingHoursRu
                        : branch.workingHoursUz}
                    </span>
                  ) : null}
                  <Link href={`/${locale}/branches/${branch.slug}`}>
                    {locale === "ru" ? "Открыть филиал →" : "Filialni ochish →"}
                  </Link>
                </div>
              </article>
            );
          })}

          {branches.length === 0 ? (
            <div className="shark-coming-soon">
              {locale === "ru"
                ? "Активные филиалы пока не опубликованы."
                : "Faol filiallar hali e’lon qilinmagan."}
            </div>
          ) : null}
        </div>
      </section>

      <section className="shark-final-cta">
        <div>
          <p className="eyebrow">SHARK TEAM</p>
          <h2>
            {locale === "ru"
              ? "Хотите сразу подобрать пробное занятие?"
              : "Sinov mashg‘ulotini darhol tanlamoqchimisiz?"}
          </h2>
          <p>
            {locale === "ru"
              ? "Выберите спорт, филиал, возраст ребёнка и свободную дату."
              : "Sport turi, filial, bolaning yoshi va bo‘sh sanani tanlang."}
          </p>
        </div>
        <Link className="button primary" href={`/${locale}/trial`}>
          {locale === "ru" ? "Записаться →" : "Yozilish →"}
        </Link>
      </section>
    </main>
  );
}
