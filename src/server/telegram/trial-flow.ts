import { getPrisma } from "@/lib/prisma";
import { BOOKABLE_GROUP_WHERE } from "@/server/public-data/visibility";
import { getTrialOptions } from "@/server/trial/get-trial-options";
import { createWebsiteLead, normalizeUzbekPhone } from "@/server/leads/create-website-lead";
import { reserveTrialBooking } from "@/server/trial/reserve-trial-booking";
import { resolveFirstTrialAmount } from "@/server/trial/first-trial-pricing";
import { recordLeadFunnelEvent } from "@/server/analytics/funnel";
import { queueConfirmedTrialNotifications } from "@/server/notifications/telegram-notifications";

type Locale = "ru" | "uz";
type Reply = { text: string; replyMarkup?: Record<string, unknown> };
const button = (text: string, data: string) => ({ text, callback_data: data });
const keyboard = (rows: ReturnType<typeof button>[][]) => ({ inline_keyboard: rows });
const escapeHtml = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const stamp = (date: string, locale: Locale) => new Intl.DateTimeFormat(locale === "uz" ? "uz-UZ" : "ru-RU", {
  timeZone: "Asia/Tashkent", day: "2-digit", month: "short", weekday: "short", hour: "2-digit", minute: "2-digit"
}).format(new Date(date));
const expired = (draft: { updatedAt: Date }) => Date.now() - draft.updatedAt.getTime() > 30 * 60_000;
const cancelled = (locale: Locale): Reply => ({
  text: locale === "uz" ? "Yozilish bekor qilindi. /start orqali qayta boshlashingiz mumkin." : "Запись отменена. Чтобы начать заново, нажмите /start."
});
const cancelRow = (locale: Locale) => [button(locale === "uz" ? "❌ Bekor qilish" : "❌ Отмена", "trial:cancel")];
const errorReply = (locale: Locale): Reply => ({
  text: locale === "uz" ? "Ma’lumot eskirgan yoki mavjud emas. /start orqali qayta urinib ko‘ring." : "Данные устарели или недоступны. Начните заново через /start."
});
const textOf = (locale: Locale, ru: string, uz: string) => locale === "uz" ? uz : ru;

async function getDraft(userId: bigint) {
  const draft = await getPrisma().telegramTrialDraft.findUnique({ where: { telegramUserId: userId } });
  return draft && !expired(draft) ? draft : null;
}

export async function beginTelegramTrial(userId: bigint, chatId: bigint, locale: Locale): Promise<Reply> {
  await getPrisma().telegramTrialDraft.upsert({
    where: { telegramUserId: userId },
    update: { chatId, locale, step: "sport", sportId: null, branchId: null, childAge: null,
      sessionId: null, parentName: null, childName: null, phone: null, leadId: null },
    create: { telegramUserId: userId, chatId, locale, step: "sport" }
  });
  const groups = await getPrisma().trainingGroup.findMany({
    where: BOOKABLE_GROUP_WHERE,
    select: { sport: { select: { id: true, nameRu: true, nameUz: true } } }
  });
  const unique = new Map(groups.map((g) => [g.sport.id, g.sport]));
  if (!unique.size) return { text: textOf(locale, "Пока нет открытых групп для записи.", "Hozir yozilish uchun ochiq guruhlar yo‘q.") };
  return {
    text: textOf(locale, "🏀 Выберите вид спорта:", "🏀 Sport turini tanlang:"),
    replyMarkup: keyboard([...unique.values()].map((s) => [button(locale === "uz" ? s.nameUz : s.nameRu, "trial:s:" + s.id)]).concat([cancelRow(locale)]))
  };
}

export async function handleTelegramTrialCallback(userId: bigint, chatId: bigint, data: string, preferredLocale: Locale = "ru"): Promise<Reply | null> {
  if (!data.startsWith("trial:")) return null;
  const draft = await getDraft(userId);
  const locale: Locale = draft ? (draft.locale === "uz" ? "uz" : "ru") : preferredLocale;
  if (data === "trial:cancel") {
    if (draft?.step === "processing" || draft?.step === "complete") {
      return { text: textOf(locale,
        "Оформленную запись эта кнопка не отменяет. Для изменения или отмены обратитесь к администратору.",
        "Tasdiqlangan yozilish bu tugma orqali bekor qilinmaydi. Administratorga murojaat qiling.") };
    }
    await getPrisma().telegramTrialDraft.deleteMany({ where: { telegramUserId: userId } });
    return cancelled(locale);
  }
  if (data === "trial:start") {
    return beginTelegramTrial(userId, chatId, locale);
  }
  if (!draft || draft.chatId !== chatId) return errorReply(locale);
  const parts = data.split(":");
  if (parts[1] === "s" && draft.step === "sport" && parts.length === 3) {
    const groups = await getPrisma().trainingGroup.findMany({
      where: { ...BOOKABLE_GROUP_WHERE, sportId: parts[2] },
      select: { branch: { select: { id: true, publicNameRu: true, publicNameUz: true } } }
    });
    const branches = new Map(groups.map((g) => [g.branch.id, g.branch]));
    if (!branches.size) return errorReply(locale);
    await getPrisma().telegramTrialDraft.update({ where: { telegramUserId: userId }, data: { sportId: parts[2], step: "branch" } });
    return {
      text: textOf(locale, "Выберите филиал:", "Filialni tanlang:"),
      replyMarkup: keyboard([...branches.values()].map(b => [button(locale === "uz" ? b.publicNameUz : b.publicNameRu, "trial:b:" + b.id)]).concat([cancelRow(locale)]))
    };
  }
  if (parts[1] === "b" && draft.step === "branch" && draft.sportId && parts.length === 3) {
    const count = await getPrisma().trainingGroup.count({ where: { ...BOOKABLE_GROUP_WHERE, sportId: draft.sportId, branchId: parts[2] } });
    if (!count) return errorReply(locale);
    await getPrisma().telegramTrialDraft.update({ where: { telegramUserId: userId }, data: { branchId: parts[2], step: "age" } });
    const ages = Array.from({ length: 12 }, (_, i) => i + 6);
    const rows = Array.from({ length: 4 }, (_, row) => ages.slice(row * 3, row * 3 + 3).map(age => button(String(age), "trial:a:" + age)));
    return { text: textOf(locale, "Сколько лет ребёнку?", "Farzandingiz necha yoshda?"), replyMarkup: keyboard([...rows, cancelRow(locale)]) };
  }
  if (parts[1] === "a" && draft.step === "age" && draft.sportId && draft.branchId && parts.length === 3) {
    const age = Number(parts[2]);
    if (!Number.isInteger(age) || age < 6 || age > 17) return errorReply(locale);
    const [sport, branch] = await Promise.all([
      getPrisma().sport.findUnique({ where: { id: draft.sportId }, select: { slug: true } }),
      getPrisma().branch.findUnique({ where: { id: draft.branchId }, select: { slug: true } })
    ]);
    if (!sport || !branch) return errorReply(locale);
    const options = await getTrialOptions(age, sport.slug, branch.slug);
    if (!options.ok || !options.bookingAvailable || !options.sessions.length) {
      return { text: textOf(locale, "Свободных пробных занятий для этого возраста нет. Нажмите /start для другого выбора.", "Bu yosh uchun bo‘sh sinov mashg‘uloti yo‘q. Boshqa variant uchun /start ni bosing.") };
    }
    await getPrisma().telegramTrialDraft.update({ where: { telegramUserId: userId }, data: { childAge: age, step: "session" } });
    return {
      text: textOf(locale, "Выберите дату пробного занятия:", "Sinov mashg‘uloti sanasini tanlang:"),
      replyMarkup: keyboard(options.sessions.slice(0, 8).map(session =>
        [button(stamp(session.startsAt, locale) + " · " + session.remainingTrialSpots, "trial:t:" + session.id)]
      ).concat([cancelRow(locale)]))
    };
  }
  if (parts[1] === "t" && draft.step === "session" && draft.sportId && draft.branchId && draft.childAge && parts.length === 3) {
    const session = await getPrisma().trainingSession.findUnique({
      where: { id: parts[2] },
      select: { group: { select: { sportId: true, branchId: true, ageMin: true, ageMax: true } }, startsAt: true, trialBookingEnabled: true, trialCapacity: true }
    });
    if (!session || session.group.sportId !== draft.sportId || session.group.branchId !== draft.branchId ||
        draft.childAge < session.group.ageMin || draft.childAge > session.group.ageMax ||
        !session.trialBookingEnabled || !session.trialCapacity || session.startsAt <= new Date()) return errorReply(locale);
    await getPrisma().telegramTrialDraft.update({ where: { telegramUserId: userId }, data: { sessionId: parts[2], step: "parent" } });
    return { text: textOf(locale, "Напишите имя родителя (минимум 2 символа):", "Ota-onaning ismini kiriting (kamida 2 belgi):") };
  }
  if (data === "trial:confirm" && draft.step === "confirm" && draft.sessionId &&
    draft.childAge && draft.childName && draft.parentName && draft.phone) {
    // Atomic step transition prevents duplicate creation on repeated Telegram callbacks.
    const claimed = await getPrisma().telegramTrialDraft.updateMany({
      where: { telegramUserId: userId, step: "confirm" },
      data: { step: "processing" }
    });
    if (claimed.count !== 1) return errorReply(locale);
    try {
      let leadId = draft.leadId;
      if (!leadId) {
        const created = await createWebsiteLead({
          parentName: draft.parentName, childName: draft.childName, childAge: draft.childAge,
          phone: draft.phone, locale, selectedSessionId: draft.sessionId,
          utmSource: "telegram", landingPage: "telegram-bot"
        });
        if (!created.ok) {
          await getPrisma().telegramTrialDraft.update({ where: { telegramUserId: userId }, data: { step: "session" } });
          return { text: textOf(locale, "Занятие недоступно или данные неверны. Нажмите /start и выберите другое.", "Mashg‘ulot mavjud emas. /start orqali qayta tanlang.") };
        }
        leadId = created.lead.id;
        await getPrisma().telegramTrialDraft.update({ where: { telegramUserId: userId }, data: { leadId } });
        await getPrisma().lead.update({ where: { id: leadId }, data: { source: "telegram" } });
      }
      const reserved = await reserveTrialBooking(leadId);
      if (!reserved.ok) {
        await getPrisma().telegramTrialDraft.update({ where: { telegramUserId: userId }, data: { step: "failed" } });
        return { text: textOf(locale,
          "Не удалось забронировать место (" + reserved.error + "). Новая запись: /start.",
          "Joyni band qilib bo‘lmadi (" + reserved.error + "). Qayta yozilish: /start.") };
      }
      await recordLeadFunnelEvent({ leadId, eventName: "lead_created", dedupeKey: "lead:" + leadId + ":created" });
      await recordLeadFunnelEvent({ leadId, eventName: "trial_booking_created", bookingId: reserved.booking.id, dedupeKey: "booking:" + reserved.booking.id + ":created" });
      await getPrisma().telegramContact.upsert({
        where: { telegramUserId: userId },
        update: { leadId, chatId, locale, lastMessageAt: new Date() },
        create: { telegramUserId: userId, chatId, locale, leadId }
      });
      if (reserved.booking.status === "CONFIRMED") {
        const bookedSession = await getPrisma().trainingSession.findUnique({
          where: { id: reserved.booking.sessionId },
          select: { startsAt: true, endsAt: true }
        });
        if (bookedSession) {
          await queueConfirmedTrialNotifications({
            bookingId: reserved.booking.id, leadId,
            startsAt: bookedSession.startsAt, endsAt: bookedSession.endsAt
          });
        }
      }
      await getPrisma().telegramTrialDraft.update({ where: { telegramUserId: userId }, data: { step: "complete", parentName: null, childName: null, phone: null } });
      const free = reserved.booking.status === "CONFIRMED";
      return {
        text: free
          ? textOf(locale, "✅ Запись подтверждена! Данные переданы в CRM. Напоминание придёт сюда.", "✅ Yozilish tasdiqlandi! Ma’lumotlar CRMga yuborildi.")
          : textOf(locale, "🕒 Место временно забронировано. Для подтверждения требуется оплата. Свяжитесь с администратором для получения реквизитов или способа оплаты.", "🕒 Joy vaqtincha band qilindi. Tasdiqlash uchun to‘lov kerak."),
        replyMarkup: free ? undefined : {
          inline_keyboard: [[{ text: locale === "uz" ? "☎️ Administrator" : "☎️ Связаться для оплаты", url: "https://sharkteam.uz/" + locale + "/contacts" }]]
        }
      };
    } catch (error) {
      console.error("Telegram trial confirmation failed", error);
      // Keep the leadId to avoid duplicating it on retry.
      await getPrisma().telegramTrialDraft.updateMany({ where: { telegramUserId: userId, step: "processing" }, data: { step: "confirm" } });
      return { text: textOf(locale, "Не получилось завершить запись. Нажмите «Подтвердить» ещё раз.", "Yozilishni tugatib bo‘lmadi. Tasdiqlashni qayta bosing."), replyMarkup: keyboard([[button(textOf(locale, "✅ Подтвердить", "✅ Tasdiqlash"), "trial:confirm")], cancelRow(locale)]) };
    }
  }
  return errorReply(locale);
}

export async function handleTelegramTrialText(userId: bigint, text: string): Promise<Reply | null> {
  const draft = await getDraft(userId);
  if (!draft || !["parent", "child", "phone"].includes(draft.step)) return null;
  const locale: Locale = draft.locale === "uz" ? "uz" : "ru";
  const value = text.trim().replace(/\s+/g, " ").slice(0, 80);
  if (draft.step === "parent" || draft.step === "child") {
    if (value.length < 2) return { text: textOf(locale, "Введите имя длиной не менее 2 символов.", "Kamida 2 belgidan iborat ism kiriting.") };
    const field = draft.step === "parent" ? "parentName" : "childName";
    await getPrisma().telegramTrialDraft.update({ where: { telegramUserId: userId }, data: { [field]: value, step: draft.step === "parent" ? "child" : "phone" } });
    return { text: draft.step === "parent"
      ? textOf(locale, "Как зовут ребёнка?", "Farzandingizning ismi nima?")
      : textOf(locale, "Укажите номер телефона родителя в формате +998XXXXXXXXX:", "Ota-onaning telefon raqamini +998XXXXXXXXX formatida kiriting:") };
  }
  const phone = normalizeUzbekPhone(value);
  if (!phone) return { text: textOf(locale, "Введите корректный номер Узбекистана: +998XXXXXXXXX.", "To‘g‘ri raqamni kiriting: +998XXXXXXXXX.") };
  await getPrisma().telegramTrialDraft.update({ where: { telegramUserId: userId }, data: { phone, step: "confirm" } });
  const session = draft.sessionId
    ? await getPrisma().trainingSession.findUnique({ where: { id: draft.sessionId }, select: { groupId: true } })
    : null;
  if (!session) return errorReply(locale);
  const firstTrialAmount = await resolveFirstTrialAmount(getPrisma(), session.groupId);
  const cost = firstTrialAmount === 0
    ? textOf(locale, "Первое пробное: бесплатно", "Birinchi sinov: bepul")
    : textOf(locale, "Пробное: " + firstTrialAmount.toLocaleString("ru-RU") + " сум (оплата после брони)",
        "Sinov: " + firstTrialAmount.toLocaleString("ru-RU") + " so‘m (bron qilgandan so‘ng to‘lov)");
  const summary = textOf(locale, "Проверьте заявку:", "Arizani tekshiring:") + "\n" +
    escapeHtml(draft.parentName ?? "") + " · " + escapeHtml(phone) + "\n" +
    escapeHtml(draft.childName ?? "") + ", " + draft.childAge + "\n" + cost;
  return { text: summary, replyMarkup: keyboard([[button(textOf(locale, "✅ Подтвердить запись", "✅ Yozilishni tasdiqlash"), "trial:confirm")], cancelRow(locale)]) };
}
