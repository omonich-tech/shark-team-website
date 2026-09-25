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
      }>;
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
    childName: "Имя ребёнка",
    parentName: "Имя родителя",
    phone: "Телефон",
    submit: "Сохранить заявку",
    saving: "Сохраняем…",
    successTitle: "Заявка получена",
    successText:
      "Мы сохранили выбранную тренировку и ваши контакты. Место будет подтверждено отдельно.",
    error: "Не удалось сохранить заявку. Проверьте данные и попробуйте ещё раз."
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
    childName: "Bolaning ismi",
    parentName: "Ota-ona ismi",
    phone: "Telefon",
    submit: "Arizani saqlash",
    saving: "Saqlanmoqda…",
    successTitle: "Ariza qabul qilindi",
    successText:
      "Tanlangan mashg‘ulot va aloqa ma’lumotlaringiz saqlandi. Joy alohida tasdiqlanadi.",
    error: "Arizani saqlab bo‘lmadi. Ma’lumotlarni tekshirib qayta urinib ko‘ring."
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
  const [result, setResult] = useState<"success" | "error" | null>(null);

  const selectedSession = useMemo(() => {
    if (!options?.ok) return null;
    return options.sessions.find((session) => session.id === selectedSessionId) ?? null;
  }, [options, selectedSessionId]);

  async function loadOptions(nextAge: string) {
    setAge(nextAge);
    setOptions(null);
    setSelectedSessionId("");
    setResult(null);

    if (!nextAge) return;

    setLoading(true);

    try {
      const response = await fetch(
        `/api/public/trial-options?age=${encodeURIComponent(nextAge)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as TrialOptions;
      setOptions(payload);
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
    setResult(null);

    const query = new URLSearchParams(window.location.search);

    try {
      const response = await fetch("/api/public/leads", {
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

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setResult("error");
        return;
      }

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
                        setResult(null);
                      }}
                    >
                      {sessionLabel(session.startsAt, locale)}
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

      {result === "success" ? (
        <div className="booking-success">
          <strong>{t.successTitle}</strong>
          <p>{t.successText}</p>
        </div>
      ) : null}

      {result === "error" ? (
        <div className="booking-error">{t.error}</div>
      ) : null}
    </div>
  );
}
