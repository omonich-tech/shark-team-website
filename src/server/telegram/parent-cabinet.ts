import {
  AttendanceStatus,
  SessionStatus,
  StudentEnrollmentStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

type Locale = "ru" | "uz";

type ParentCabinetResponse =
  | {
      ok: true;
      locale: Locale;
      text: string;
      replyMarkup: Record<string, unknown>;
    }
  | {
      ok: false;
      error:
        | "CONTACT_NOT_FOUND"
        | "PARENT_NOT_LINKED"
        | "CHILD_NOT_AVAILABLE"
        | "NO_STUDENTS";
      locale: Locale;
      text: string;
      replyMarkup?: Record<string, unknown>;
    };

function localeOf(value: string | null | undefined): Locale {
  return value === "uz" ? "uz" : "ru";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatDate(value: Date | null | undefined, locale: Locale) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(locale === "uz" ? "uz-UZ" : "ru-RU", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(value);
}

function formatDateTime(value: Date | null | undefined, locale: Locale) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(locale === "uz" ? "uz-UZ" : "ru-RU", {
    timeZone: "Asia/Tashkent",
    weekday: "short",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function averageAssessment(item: {
  ability: number;
  discipline: number;
  motivation: number;
  coordination: number;
  physicalPreparation: number;
  psychologicalReadiness: number;
}) {
  return (
    item.ability +
    item.discipline +
    item.motivation +
    item.coordination +
    item.physicalPreparation +
    item.psychologicalReadiness
  ) / 6;
}


function attendanceStatusLabel(
  status: AttendanceStatus,
  locale: Locale
) {
  if (locale === "uz") {
    if (status === AttendanceStatus.PRESENT) return "qatnashdi";
    if (status === AttendanceStatus.EXCUSED) return "sababli kelmadi";
    return "kelmadi";
  }

  if (status === AttendanceStatus.PRESENT) return "присутствовал";
  if (status === AttendanceStatus.EXCUSED) return "уважительный пропуск";
  return "отсутствовал";
}

function subscriptionStatusLabel(
  status: string,
  locale: Locale
) {
  const ru: Record<string, string> = {
    ACTIVE: "активен",
    PAYMENT_DUE: "скоро оплата",
    PAST_DUE: "оплата просрочена",
    FROZEN: "заморожен",
    PAUSED: "приостановлен",
    ENDED: "завершён"
  };
  const uz: Record<string, string> = {
    ACTIVE: "faol",
    PAYMENT_DUE: "to‘lov vaqti",
    PAST_DUE: "to‘lov muddati o‘tgan",
    FROZEN: "muzlatilgan",
    PAUSED: "to‘xtatilgan",
    ENDED: "yakunlangan"
  };

  return (locale === "uz" ? uz : ru)[status] ?? status;
}

function paymentStatusLabel(
  status: string,
  locale: Locale
) {
  const ru: Record<string, string> = {
    PENDING: "ожидается",
    UNDER_REVIEW: "на проверке",
    PAID: "оплачен",
    REJECTED: "отклонён",
    CANCELLED: "отменён",
    REFUNDED: "возвращён"
  };
  const uz: Record<string, string> = {
    PENDING: "kutilmoqda",
    UNDER_REVIEW: "tekshiruvda",
    PAID: "to‘langan",
    REJECTED: "rad etilgan",
    CANCELLED: "bekor qilingan",
    REFUNDED: "qaytarilgan"
  };

  return (locale === "uz" ? uz : ru)[status] ?? status;
}

function homeButton(locale: Locale) {
  return {
    text: locale === "uz" ? "🏠 Bosh sahifa" : "🏠 Главная",
    callback_data: "parent:home"
  };
}

function childMenu(childId: string, locale: Locale) {
  return {
    inline_keyboard: [
      [
        {
          text: locale === "uz" ? "📅 Jadval" : "📅 Расписание",
          callback_data: "parent:schedule:" + childId
        },
        {
          text: locale === "uz" ? "✅ Davomat" : "✅ Посещаемость",
          callback_data: "parent:attendance:" + childId
        }
      ],
      [
        {
          text: locale === "uz" ? "💳 Abonement" : "💳 Абонемент",
          callback_data: "parent:subscription:" + childId
        },
        {
          text: locale === "uz" ? "📈 Rivojlanish" : "📈 Прогресс",
          callback_data: "parent:progress:" + childId
        }
      ],
      [homeButton(locale)]
    ]
  };
}

async function getVerifiedContact(telegramUserId: bigint) {
  const prisma = getPrisma();

  return prisma.telegramContact.findUnique({
    where: { telegramUserId },
    include: { parent: true }
  });
}

async function getParentChildren(parentId: string) {
  const prisma = getPrisma();

  return prisma.child.findMany({
    where: {
      parentId,
      enrollments: {
        some: {
          status: {
            in: [
              StudentEnrollmentStatus.ACTIVE,
              StudentEnrollmentStatus.PAUSED
            ]
          }
        }
      }
    },
    include: {
      enrollments: {
        where: {
          status: {
            in: [
              StudentEnrollmentStatus.ACTIVE,
              StudentEnrollmentStatus.PAUSED
            ]
          }
        },
        include: {
          group: {
            include: {
              sport: true,
              branch: true,
              primaryCoach: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: { name: "asc" }
  });
}

async function getChildForParent(
  parentId: string,
  childId: string,
  now: Date
) {
  const prisma = getPrisma();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return prisma.child.findFirst({
    where: {
      id: childId,
      parentId
    },
    include: {
      enrollments: {
        where: {
          status: {
            in: [
              StudentEnrollmentStatus.ACTIVE,
              StudentEnrollmentStatus.PAUSED
            ]
          }
        },
        include: {
          group: {
            include: {
              sport: true,
              branch: true,
              primaryCoach: true,
              sessions: {
                where: {
                  status: SessionStatus.SCHEDULED,
                  startsAt: { gt: now }
                },
                orderBy: { startsAt: "asc" },
                take: 3
              }
            }
          },
          payments: {
            orderBy: { sequence: "desc" },
            take: 2
          }
        },
        orderBy: { createdAt: "desc" }
      },
      attendances: {
        where: {
          trialBookingId: null,
          session: {
            startsAt: {
              gte: since30,
              lte: now
            }
          }
        },
        include: {
          session: {
            include: {
              group: {
                include: {
                  sport: true
                }
              }
            }
          }
        },
        orderBy: {
          session: { startsAt: "desc" }
        },
        take: 12
      },
      progressAssessments: {
        orderBy: { assessedAt: "desc" },
        take: 20,
        include: {
          group: {
            include: {
              sport: true
            }
          }
        }
      }
    }
  });
}

export async function buildParentCabinetHome(
  telegramUserId: bigint
): Promise<ParentCabinetResponse> {
  const contact = await getVerifiedContact(telegramUserId);
  const locale = localeOf(contact?.locale);

  if (!contact) {
    return {
      ok: false,
      error: "CONTACT_NOT_FOUND",
      locale,
      text:
        locale === "uz"
          ? "Avval Telegram’ni SHARK TEAM shaxsiy havolasi orqali ulang."
          : "Сначала подключите Telegram через персональную ссылку SHARK TEAM."
    };
  }

  if (!contact.parentId || !contact.parent) {
    return {
      ok: false,
      error: "PARENT_NOT_LINKED",
      locale,
      text:
        locale === "uz"
          ? "Shaxsiy kabinet doimiy o‘quvchi sifatida ro‘yxatdan o‘tgandan keyin ochiladi."
          : "Личный кабинет станет доступен после зачисления ребёнка как постоянного ученика."
    };
  }

  const children = await getParentChildren(contact.parentId);

  if (children.length === 0) {
    return {
      ok: false,
      error: "NO_STUDENTS",
      locale,
      text:
        locale === "uz"
          ? "Hozircha faol abonementga ega o‘quvchi topilmadi."
          : "Сейчас не найдено детей с активным или приостановленным абонементом."
    };
  }

  if (children.length === 1) {
    return buildParentCabinetView(
      telegramUserId,
      "child",
      children[0].id
    );
  }

  const lines =
    locale === "uz"
      ? [
          "👨‍👩‍👧 <b>SHARK TEAM · Ota-ona kabineti</b>",
          "",
          "Farzandingizni tanlang:"
        ]
      : [
          "👨‍👩‍👧 <b>SHARK TEAM · Кабинет родителя</b>",
          "",
          "Выберите ребёнка:"
        ];

  return {
    ok: true,
    locale,
    text: lines.join("\n"),
    replyMarkup: {
      inline_keyboard: children.map((child) => {
        const enrollment = child.enrollments[0];
        const label = enrollment
          ? child.name + " · " + enrollment.group.sport[
              locale === "uz" ? "nameUz" : "nameRu"
            ]
          : child.name;

        return [
          {
            text: "👤 " + label,
            callback_data: "parent:child:" + child.id
          }
        ];
      })
    }
  };
}

export async function buildParentCabinetView(
  telegramUserId: bigint,
  view:
    | "child"
    | "schedule"
    | "attendance"
    | "subscription"
    | "progress",
  childId: string,
  now = new Date()
): Promise<ParentCabinetResponse> {
  const contact = await getVerifiedContact(telegramUserId);
  const locale = localeOf(contact?.locale);

  if (!contact) {
    return {
      ok: false,
      error: "CONTACT_NOT_FOUND",
      locale,
      text:
        locale === "uz"
          ? "Telegram kontakt topilmadi."
          : "Telegram-контакт не найден."
    };
  }

  if (!contact.parentId) {
    return {
      ok: false,
      error: "PARENT_NOT_LINKED",
      locale,
      text:
        locale === "uz"
          ? "Ota-ona profili hali ulanmagan."
          : "Профиль родителя ещё не связан."
    };
  }

  const child = await getChildForParent(contact.parentId, childId, now);

  if (!child) {
    return {
      ok: false,
      error: "CHILD_NOT_AVAILABLE",
      locale,
      text:
        locale === "uz"
          ? "Bu bola sizning kabinetingizda mavjud emas."
          : "Этот ребёнок недоступен в вашем кабинете."
    };
  }

  if (child.enrollments.length === 0) {
    return {
      ok: false,
      error: "NO_STUDENTS",
      locale,
      text:
        locale === "uz"
          ? "Faol guruh topilmadi."
          : "Активная группа не найдена."
    };
  }

  if (view === "schedule") {
    const sessions = child.enrollments.flatMap((enrollment) =>
      enrollment.group.sessions.map((session) => ({
        ...session,
        groupName: enrollment.group.internalName,
        sportName:
          locale === "uz"
            ? enrollment.group.sport.nameUz
            : enrollment.group.sport.nameRu
      }))
    );

    sessions.sort(
      (a, b) => a.startsAt.getTime() - b.startsAt.getTime()
    );

    const lines =
      locale === "uz"
        ? [
            "📅 <b>" + escapeHtml(child.name) + " · Yaqin mashg‘ulotlar</b>",
            "",
            ...sessions.slice(0, 6).map(
              (session) =>
                "• " +
                escapeHtml(formatDateTime(session.startsAt, locale)) +
                " · " +
                escapeHtml(session.sportName)
            )
          ]
        : [
            "📅 <b>" + escapeHtml(child.name) + " · Ближайшие тренировки</b>",
            "",
            ...sessions.slice(0, 6).map(
              (session) =>
                "• " +
                escapeHtml(formatDateTime(session.startsAt, locale)) +
                " · " +
                escapeHtml(session.sportName)
            )
          ];

    if (sessions.length === 0) {
      lines.push(
        locale === "uz"
          ? "Yaqin mashg‘ulotlar hali rejalashtirilmagan."
          : "Ближайшие тренировки пока не запланированы."
      );
    }

    return {
      ok: true,
      locale,
      text: lines.join("\n"),
      replyMarkup: childMenu(child.id, locale)
    };
  }

  if (view === "attendance") {
    const total = child.attendances.length;
    const present = child.attendances.filter(
      (item) => item.status === AttendanceStatus.PRESENT
    ).length;
    const rate = total > 0 ? Math.round((present / total) * 100) : null;

    const lines =
      locale === "uz"
        ? [
            "✅ <b>" + escapeHtml(child.name) + " · Davomat</b>",
            "",
            "Oxirgi 30 kun: <b>" +
              (rate === null ? "—" : rate + "%") +
              "</b> · " +
              present +
              "/" +
              total,
            "",
            ...child.attendances.slice(0, 6).map(
              (item) =>
                "• " +
                escapeHtml(formatDateTime(item.session.startsAt, locale)) +
                " · " +
                escapeHtml(attendanceStatusLabel(item.status, locale))
            )
          ]
        : [
            "✅ <b>" + escapeHtml(child.name) + " · Посещаемость</b>",
            "",
            "Последние 30 дней: <b>" +
              (rate === null ? "—" : rate + "%") +
              "</b> · " +
              present +
              "/" +
              total,
            "",
            ...child.attendances.slice(0, 6).map(
              (item) =>
                "• " +
                escapeHtml(formatDateTime(item.session.startsAt, locale)) +
                " · " +
                escapeHtml(attendanceStatusLabel(item.status, locale))
            )
          ];

    return {
      ok: true,
      locale,
      text: lines.join("\n"),
      replyMarkup: childMenu(child.id, locale)
    };
  }

  if (view === "subscription") {
    const lines =
      locale === "uz"
        ? [
            "💳 <b>" + escapeHtml(child.name) + " · Abonementlar</b>",
            ""
          ]
        : [
            "💳 <b>" + escapeHtml(child.name) + " · Абонементы</b>",
            ""
          ];

    for (const enrollment of child.enrollments) {
      const latestPayment = enrollment.payments[0];
      const enrollmentSport =
        locale === "uz"
          ? enrollment.group.sport.nameUz
          : enrollment.group.sport.nameRu;
      const status =
        enrollment.subscriptionStatus ?? enrollment.status;

      lines.push(
        "<b>" +
          escapeHtml(enrollmentSport) +
          " · " +
          escapeHtml(enrollment.group.internalName) +
          "</b>",
        (locale === "uz" ? "Holat: " : "Статус: ") +
          "<b>" +
          escapeHtml(subscriptionStatusLabel(status, locale)) +
          "</b>",
        (locale === "uz" ? "To‘langan davr: " : "Оплаченный период: ") +
          escapeHtml(formatDate(enrollment.currentPeriodStart, locale)) +
          " → " +
          escapeHtml(formatDate(enrollment.currentPeriodEnd, locale)),
        (locale === "uz" ? "Keyingi to‘lov: " : "Следующая оплата: ") +
          escapeHtml(formatDate(enrollment.nextPaymentDueAt, locale)),
        enrollment.graceUntil
          ? (locale === "uz"
              ? "Imtiyozli muddat: "
              : "Льготный период: до ") +
            escapeHtml(formatDate(enrollment.graceUntil, locale))
          : "",
        latestPayment
          ? (locale === "uz" ? "Oxirgi to‘lov: " : "Последний платёж: ") +
            escapeHtml(paymentStatusLabel(latestPayment.status, locale)) +
            " · " +
            formatMoney(latestPayment.amountUzs) +
            " UZS"
          : "",
        ""
      );
    }

    return {
      ok: true,
      locale,
      text: lines.filter((line, index) => Boolean(line) || index === lines.length - 1).join("\n").trim(),
      replyMarkup: childMenu(child.id, locale)
    };
  }

  if (view === "progress") {
    const latest = child.progressAssessments[0];

    if (!latest) {
      return {
        ok: true,
        locale,
        text:
          locale === "uz"
            ? "📈 <b>" +
              escapeHtml(child.name) +
              " · Rivojlanish</b>\n\nMurabbiyning muntazam bahosi hali yo‘q."
            : "📈 <b>" +
              escapeHtml(child.name) +
              " · Прогресс</b>\n\nРегулярной оценки тренера пока нет.",
        replyMarkup: childMenu(child.id, locale)
      };
    }

    const lines =
      locale === "uz"
        ? [
            "📈 <b>" + escapeHtml(child.name) + " · Rivojlanish</b>",
            ""
          ]
        : [
            "📈 <b>" + escapeHtml(child.name) + " · Прогресс</b>",
            ""
          ];

    for (const enrollment of child.enrollments) {
      const assessments = child.progressAssessments.filter(
        (item) => item.groupId === enrollment.groupId
      );
      const current = assessments[0];
      const previous = assessments[1];
      const enrollmentSport =
        locale === "uz"
          ? enrollment.group.sport.nameUz
          : enrollment.group.sport.nameRu;

      lines.push(
        "<b>" +
          escapeHtml(enrollmentSport) +
          " · " +
          escapeHtml(enrollment.group.internalName) +
          "</b>"
      );

      if (!current) {
        lines.push(
          locale === "uz"
            ? "Murabbiyning muntazam bahosi hali yo‘q."
            : "Регулярной оценки тренера пока нет.",
          ""
        );
        continue;
      }

      const currentAverage = averageAssessment(current);
      const previousAverage = previous
        ? averageAssessment(previous)
        : null;
      const delta =
        previousAverage === null
          ? null
          : currentAverage - previousAverage;

      lines.push(
        (locale === "uz" ? "Oxirgi baho: " : "Последняя оценка: ") +
          "<b>" +
          currentAverage.toFixed(1) +
          " / 5</b>" +
          (delta === null
            ? ""
            : " · " +
              (delta >= 0 ? "+" : "") +
              delta.toFixed(1)),
        (locale === "uz" ? "Sana: " : "Дата: ") +
          escapeHtml(formatDate(current.assessedAt, locale)),
        (locale === "uz" ? "Ko‘nikma: " : "Навыки: ") +
          current.ability +
          "/5",
        (locale === "uz" ? "Intizom: " : "Дисциплина: ") +
          current.discipline +
          "/5",
        (locale === "uz" ? "Motivatsiya: " : "Мотивация: ") +
          current.motivation +
          "/5",
        (locale === "uz" ? "Koordinatsiya: " : "Координация: ") +
          current.coordination +
          "/5",
        (locale === "uz"
          ? "Jismoniy tayyorgarlik: "
          : "Физподготовка: ") +
          current.physicalPreparation +
          "/5",
        (locale === "uz"
          ? "Psixologik tayyorgarlik: "
          : "Психологическая готовность: ") +
          current.psychologicalReadiness +
          "/5",
        current.coachComment
          ? (locale === "uz"
              ? "Murabbiy izohi: "
              : "Комментарий тренера: ") +
            escapeHtml(current.coachComment)
          : "",
        current.recommendation
          ? (locale === "uz" ? "Tavsiya: " : "Рекомендация: ") +
            escapeHtml(current.recommendation)
          : "",
        ""
      );
    }

    return {
      ok: true,
      locale,
      text: lines.filter((line, index) => Boolean(line) || index === lines.length - 1).join("\n").trim(),
      replyMarkup: childMenu(child.id, locale)
    };
  }

  const attendanceTotal = child.attendances.length;
  const attendancePresent = child.attendances.filter(
    (item) => item.status === AttendanceStatus.PRESENT
  ).length;
  const attendanceRate =
    attendanceTotal > 0
      ? Math.round((attendancePresent / attendanceTotal) * 100)
      : null;

  const lines =
    locale === "uz"
      ? [
          "👤 <b>" + escapeHtml(child.name) + "</b>",
          "",
          "Faol yo‘nalishlar: <b>" + child.enrollments.length + "</b>",
          "Davomat · 30 kun: <b>" +
            (attendanceRate === null ? "—" : attendanceRate + "%") +
            "</b>",
          ""
        ]
      : [
          "👤 <b>" + escapeHtml(child.name) + "</b>",
          "",
          "Активных направлений: <b>" + child.enrollments.length + "</b>",
          "Посещаемость · 30 дней: <b>" +
            (attendanceRate === null ? "—" : attendanceRate + "%") +
            "</b>",
          ""
        ];

  for (const enrollment of child.enrollments) {
    const enrollmentSport =
      locale === "uz"
        ? enrollment.group.sport.nameUz
        : enrollment.group.sport.nameRu;
    const enrollmentBranch =
      locale === "uz"
        ? enrollment.group.branch.publicNameUz
        : enrollment.group.branch.publicNameRu;
    const enrollmentCoach = [
      enrollment.group.primaryCoach.firstName,
      enrollment.group.primaryCoach.lastName
    ]
      .filter(Boolean)
      .join(" ");
    const nextSession = enrollment.group.sessions[0];
    const progress = child.progressAssessments.find(
      (item) => item.groupId === enrollment.groupId
    );
    const status =
      enrollment.subscriptionStatus ?? enrollment.status;

    lines.push(
      "<b>" +
        escapeHtml(enrollmentSport) +
        " · " +
        escapeHtml(enrollment.group.internalName) +
        "</b>",
      (locale === "uz" ? "Filial: " : "Филиал: ") +
        escapeHtml(enrollmentBranch),
      (locale === "uz" ? "Murabbiy: " : "Тренер: ") +
        escapeHtml(enrollmentCoach || "—"),
      (locale === "uz"
        ? "Keyingi mashg‘ulot: "
        : "Следующая тренировка: ") +
        "<b>" +
        escapeHtml(formatDateTime(nextSession?.startsAt, locale)) +
        "</b>",
      (locale === "uz" ? "Abonement: " : "Абонемент: ") +
        "<b>" +
        escapeHtml(subscriptionStatusLabel(status, locale)) +
        "</b>",
      (locale === "uz" ? "Rivojlanish: " : "Прогресс: ") +
        "<b>" +
        (progress
          ? averageAssessment(progress).toFixed(1) + " / 5"
          : "—") +
        "</b>",
      ""
    );
  }

  return {
    ok: true,
    locale,
    text: lines.join("\n").trim(),
    replyMarkup: childMenu(child.id, locale)
  };
}

export async function handleParentCabinetCallback(
  telegramUserId: bigint,
  data: string
): Promise<ParentCabinetResponse | null> {
  if (!data.startsWith("parent:")) return null;

  const parts = data.split(":");
  const action = parts[1];

  if (action === "home") {
    return buildParentCabinetHome(telegramUserId);
  }

  const childId = parts[2];

  if (
    !childId ||
    !["child", "schedule", "attendance", "subscription", "progress"].includes(
      action
    )
  ) {
    return null;
  }

  return buildParentCabinetView(
    telegramUserId,
    action as
      | "child"
      | "schedule"
      | "attendance"
      | "subscription"
      | "progress",
    childId
  );
}


export async function resolveParentCabinetIntent(
  telegramUserId: bigint,
  rawText: string
): Promise<ParentCabinetResponse | null> {
  const text = rawText.trim().toLowerCase();

  const cabinetIntent = [
    "кабинет",
    "личный кабинет",
    "мои дети",
    "мой ребенок",
    "мой ребёнок",
    "kabinet",
    "farzandim",
    "bolam"
  ].some((value) => text.includes(value));

  const scheduleIntent = [
    "мое расписание",
    "моё расписание",
    "расписание ребенка",
    "расписание ребёнка",
    "jadvalim",
    "bola jadvali"
  ].some((value) => text.includes(value));

  const attendanceIntent = [
    "посещаемость",
    "мои посещения",
    "пропуски ребенка",
    "пропуски ребёнка",
    "davomat"
  ].some((value) => text.includes(value));

  const subscriptionIntent = [
    "мой абонемент",
    "абонемент ребенка",
    "абонемент ребёнка",
    "abonementim",
    "abonement"
  ].some((value) => text.includes(value));

  const progressIntent = [
    "прогресс ребенка",
    "прогресс ребёнка",
    "мой прогресс",
    "развитие ребенка",
    "развитие ребёнка",
    "rivojlanish"
  ].some((value) => text.includes(value));

  if (
    !cabinetIntent &&
    !scheduleIntent &&
    !attendanceIntent &&
    !subscriptionIntent &&
    !progressIntent
  ) {
    return null;
  }

  const home = await buildParentCabinetHome(telegramUserId);

  if (!home.ok) {
    return home.error === "NO_STUDENTS" ||
      home.error === "PARENT_NOT_LINKED"
      ? null
      : home;
  }

  const contact = await getVerifiedContact(telegramUserId);
  if (!contact?.parentId) return home;

  const children = await getParentChildren(contact.parentId);

  if (cabinetIntent || children.length !== 1) {
    return home;
  }

  const childId = children[0].id;

  if (scheduleIntent) {
    return buildParentCabinetView(
      telegramUserId,
      "schedule",
      childId
    );
  }

  if (attendanceIntent) {
    return buildParentCabinetView(
      telegramUserId,
      "attendance",
      childId
    );
  }

  if (subscriptionIntent) {
    return buildParentCabinetView(
      telegramUserId,
      "subscription",
      childId
    );
  }

  if (progressIntent) {
    return buildParentCabinetView(
      telegramUserId,
      "progress",
      childId
    );
  }

  return home;
}
