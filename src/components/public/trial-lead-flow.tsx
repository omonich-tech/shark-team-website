"use client";

import { FormEvent, useMemo, useState } from "react";
import type { PublicLocale } from "@/lib/public-i18n";

type TrialOptions =
  | {
      ok: false;
      error: string;
    }
  | {
      ok: true;
      bookingAvailable: boolean;
      reason: string | null;
      group: {
        id: string;
        ageMin: number;
        ageMax: number;
        branchNameRu: string;
        branchNameUz: string;
        sportNameRu: string;
        sportNameUz: string;
        coachName: string;
      };
      sessions: Array<{
        id: string;
        startsAt: string;
        endsAt: string;
        remainingTrialSpots: number;
      }>;
    };

type Reservation = {
  id: string;
  status: string;
  expiresAt: string;
  reminderAt: string | null;
  sessionId: string;
};

const copy = {
  ru: {
    ageLabel: "Возраст ребёнка",
    agePlaceholder: "Выберите возраст",
    loading: "Ищем подходящую группу…",
    noGroup: "Для этого возраста подходящая группа пока не найдена.",
    capacityPending:
      "Онлайн-запись на пробное для этой группы пока не открыта.",
    noSessions: "Свободные даты пока не опубликованы.",
    groupTitle: "Подходящая группа",
    chooseDate: "Выберите дату пробного",
    spots: "мест",
    childName: "Имя ребёнка",
    parentName: "Имя родителя",
    phone: "Телефон",
    submit: "Забронировать пробное",
    saving: "Бронируем…",
    successTitle: "Место временно забронировано",
    successPrefix: "Место удерживается до",
    successSuffix:
      "После оплаты бронь будет подтверждена окончательно.",
    full:
      "Это место только что заняли. Мы обновили доступные даты — выберите другую тренировку.",
    error: "Не удалось оформить бронь. Проверьте данные и попробуйте ещё раз."
  },
  uz: {
    ageLabel: "Bolaning yoshi",
    agePlaceholder: "Yoshni tanlang",
    loading: "Mos guruhni qidirmoqdamiz…",
    noGroup: "Bu yosh uchun mos guruh hozircha topilmadi.",
    capacityPending:
      "Bu guruh uchun onlayn sinov yozuvi hozircha ochilmagan.",
    noSessions: "Bo‘sh sanalar hozircha e’lon qilinmagan.",
    groupTitle: "Mos guruh",
    chooseDate: "Sinov mashg‘uloti sanasini tanlang",
    spots: "joy",
    childName: "Bolaning ismi",
    parentName: "Ota-ona ismi",
    phone: "Telefon",
    submit: "Sinov joyini band qilish",
    saving: "Band qilinmoqda…",
    successTitle: "Joy vaqtincha band qilindi",
    successPrefix: "Joy quyidagi vaqtgacha saqlanadi:",
    successSuffix:
      "To‘lovdan keyin bron yakuniy tasdiqlanadi.",
    full:
      "Bu joy hozirgina band qilindi. Mavjud sanalarni yangiladik — boshqa mashg‘ulotni tanlang.",
    error: "Bronni rasmiylashtirib bo‘lmadi. Ma’lumotlarni tekshirib qayta urinib ko‘ring."
  }
} as const;

function sessionLabel(iso: string, locale: PublicLocale) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "uz-UZ", {
    timeZone: "Asia/Tashkent",
    weekday: "short",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function holdLabel(iso: string, locale: PublicLocale) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

export function TrialLeadFlow({ locale }: { locale: PublicLocale }) {
  const t = copy[locale];
  const [age, setAge] = useState("");
  const [options, setOptions] = useState<TrialOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [childName, setChildName] = useState("");
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [result, setResult] = useState<
    "success" | "error" | "full" | null
  >(null);

  const selectedSession = useMemo(() => {
    if (!options?.ok) return null;
    return (
      options.sessions.find((session) => session.id === selectedSessionId) ??
      null
    );
  }, [options, selectedSessionId]);

  async function fetchOptions(nextAge: string) {
    const response = await fetch(
      `/api/public/trial-options?age=${encodeURIComponent(nextAge)}`,
      { cache: "no-store" }
    );

    return (await response.json()) as TrialOptions;
  }

  async function loadOptions(nextAge: string) {
    setAge(nextAge);
    setOptions(null);
    setSelectedSessionId("");
    setReservation(null);
    setResult(null);

    if (!nextAge) return;

    setLoading(true);

    try {
      setOptions(await fetchOptions(nextAge));
    } catch {
      setOptions({ ok: false, error: "NETWORK_ERROR" });
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSession || !age) return;

    setSubmitting(true);
    setReservation(null);
    setResult(null);

    const query = new URLSearchParams(window.location.search);

    try {
      const leadResponse = await fetch("/api/public/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          parentName,
          childName,
          phone,
          childAge: Number(age),
          locale,
          selectedSessionId: selectedSession.id,
          landingPage: window.location.pathname,
          utmSource: query.get("utm_source"),
          utmMedium: query.get("utm_medium"),
          utmCampaign: query.get("utm_campaign"),
          utmContent: query.get("utm_content")
        })
      });

      const leadPayload = await leadResponse.json();

      if (!leadResponse.ok || !leadPayload.ok) {
        setResult("error");
        return;
      }

      const bookingResponse = await fetch("/api/public/trial-bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          leadId: leadPayload.lead.id
        })
      });

      const bookingPayload = await bookingResponse.json();

      if (
        bookingResponse.status === 409 &&
        bookingPayload.error === "SLOT_FULL"
      ) {
        setSelectedSessionId("");
        setOptions(await fetchOptions(age));
        setResult("full");
        return;
      }

      if (!bookingResponse.ok || !bookingPayload.ok) {
        setResult("error");
        return;
      }

      setReservation(bookingPayload.booking as Reservation);
      setResult("success");
    } catch {
      setResult("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="booking-flow">
      <div className="booking-step">
        <span className="step-number">1</span>
        <div className="booking-field-wrap">
          <label htmlFor="child-age">{t.ageLabel}</label>
          <select
            id="child-age"
            value={age}
            onChange={(event) => void loadOptions(event.target.value)}
          >
            <option value="">{t.agePlaceholder}</option>
            {Array.from({ length: 10 }, (_, index) => index + 6).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? <p className="booking-note">{t.loading}</p> : null}

      {options && !options.ok ? (
        <div className="booking-message">{t.noGroup}</div>
      ) : null}

      {options?.ok ? (
        <>
          <div className="booking-summary">
            <span>{t.groupTitle}</span>
            <strong>
              {options.group.ageMin}–{options.group.ageMax}{" "}
              {locale === "ru" ? "лет" : "yosh"}
            </strong>
            <p>
              {locale === "ru"
                ? options.group.branchNameRu
                : options.group.branchNameUz}
              {" · "}
              {options.group.coachName}
            </p>
          </div>

          {!options.bookingAvailable ? (
            <div className="booking-message">
              {options.reason === "TRIAL_CAPACITY_NOT_CONFIGURED"
                ? t.capacityPending
                : t.noSessions}
            </div>
          ) : (
            <div className="booking-step">
              <span className="step-number">2</span>
              <div className="booking-field-wrap">
                <span className="booking-label">{t.chooseDate}</span>
                <div className="session-grid">
                  {options.sessions.map((session) => (
                    <button
                      className={
                        selectedSessionId === session.id
                          ? "session-option selected"
                          : "session-option"
                      }
                      type="button"
                      key={session.id}
                      onClick={() => {
                        setSelectedSessionId(session.id);
                        setReservation(null);
                        setResult(null);
                      }}
                    >
                      <span>{sessionLabel(session.startsAt, locale)}</span>
                      <small>
                        {session.remainingTrialSpots} {t.spots}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}

      {selectedSession ? (
        <form className="booking-form" onSubmit={submit}>
          <div className="booking-step">
            <span className="step-number">3</span>
            <div className="booking-fields">
              <label>
                <span>{t.childName}</span>
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={childName}
                  onChange={(event) => setChildName(event.target.value)}
                />
              </label>
              <label>
                <span>{t.parentName}</span>
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={parentName}
                  onChange={(event) => setParentName(event.target.value)}
                />
              </label>
              <label>
                <span>{t.phone}</span>
                <input
                  required
                  inputMode="tel"
                  placeholder="+998 90 123 45 67"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </label>
            </div>
          </div>

          <button className="button primary form-submit" disabled={submitting}>
            {submitting ? t.saving : t.submit}
          </button>
        </form>
      ) : null}

      {result === "success" && reservation ? (
        <div className="booking-success">
          <strong>{t.successTitle}</strong>
          <p>
            {t.successPrefix}{" "}
            <b>{holdLabel(reservation.expiresAt, locale)}</b>.{" "}
            {t.successSuffix}
          </p>
        </div>
      ) : null}

      {result === "full" ? (
        <div className="booking-error">{t.full}</div>
      ) : null}

      {result === "error" ? (
        <div className="booking-error">{t.error}</div>
      ) : null}
    </div>
  );
}
