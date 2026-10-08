"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const weekdays = [
  ["MONDAY", "Пн"],
  ["TUESDAY", "Вт"],
  ["WEDNESDAY", "Ср"],
  ["THURSDAY", "Чт"],
  ["FRIDAY", "Пт"],
  ["SATURDAY", "Сб"],
  ["SUNDAY", "Вс"]
] as const;

export function GroupCreateForm({
  branches,
  sports,
  coaches
}: {
  branches: Array<{ id: string; name: string }>;
  sports: Array<{ id: string; name: string }>;
  coaches: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [sportId, setSportId] = useState(sports[0]?.id ?? "");
  const [primaryCoachId, setPrimaryCoachId] = useState(coaches[0]?.id ?? "");
  const [internalName, setInternalName] = useState("");
  const [ageMin, setAgeMin] = useState(6);
  const [ageMax, setAgeMax] = useState(8);
  const [capacityRegular, setCapacityRegular] = useState(20);
  const [capacityTrial, setCapacityTrial] = useState<number | "">("");
  const [status, setStatus] = useState("DRAFT");
  const [enrollmentStatus, setEnrollmentStatus] = useState("PAUSED");
  const [level, setLevel] = useState("");
  const [notesInternal, setNotesInternal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [days, setDays] = useState<string[]>([
    "TUESDAY",
    "THURSDAY",
    "SATURDAY"
  ]);
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("18:00");
  const [state, setState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  function toggleDay(day: string) {
    setDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day]
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          sportId,
          primaryCoachId,
          internalName,
          ageMin,
          ageMax,
          capacityRegular,
          capacityTrial: capacityTrial === "" ? null : capacityTrial,
          status,
          enrollmentStatus,
          level: level || null,
          notesInternal: notesInternal || null,
          startDate: startDate || null,
          endDate: endDate || null,
          schedule: days.map((weekday) => ({ weekday, start, end }))
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage(
          payload.error === "INVALID_GROUP_DATE_RANGE"
            ? "Дата окончания не может быть раньше даты начала."
            : payload.error ?? "Не удалось создать группу."
        );
        return;
      }

      setState("saved");
      setMessage(
        status === "ACTIVE"
          ? "Группа создана, будущие занятия сгенерированы."
          : "Группа создана в рабочем статусе без публикации."
      );
      setInternalName("");
      router.refresh();
    } catch {
      setState("error");
      setMessage("Не удалось создать группу.");
    }
  }

  return (
    <form className="admin-group-editor" onSubmit={submit}>
      <div className="admin-editor-grid">
        <label className="admin-field">
          <span>Филиал</span>
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
          >
            {branches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Вид спорта</span>
          <select
            value={sportId}
            onChange={(event) => setSportId(event.target.value)}
          >
            {sports.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Основной тренер</span>
          <select
            value={primaryCoachId}
            onChange={(event) => setPrimaryCoachId(event.target.value)}
          >
            {coaches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Внутреннее название</span>
          <input
            required
            value={internalName}
            onChange={(event) => setInternalName(event.target.value)}
            placeholder="Basketball 8–10 · Tue Thu Sat"
          />
        </label>

        <label className="admin-field">
          <span>Возраст от</span>
          <input
            type="number"
            min={3}
            max={19}
            value={ageMin}
            onChange={(event) => setAgeMin(Number(event.target.value))}
          />
        </label>

        <label className="admin-field">
          <span>Возраст до</span>
          <input
            type="number"
            min={3}
            max={19}
            value={ageMax}
            onChange={(event) => setAgeMax(Number(event.target.value))}
          />
        </label>

        <label className="admin-field">
          <span>Вместимость</span>
          <input
            type="number"
            min={1}
            max={100}
            value={capacityRegular}
            onChange={(event) =>
              setCapacityRegular(Number(event.target.value))
            }
          />
        </label>

        <label className="admin-field">
          <span>Пробных мест / занятие</span>
          <input
            type="number"
            min={0}
            max={30}
            placeholder="Не задано"
            value={capacityTrial}
            onChange={(event) =>
              setCapacityTrial(
                event.target.value === ""
                  ? ""
                  : Number(event.target.value)
              )
            }
          />
        </label>

        <label className="admin-field">
          <span>Статус группы</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
          </select>
        </label>

        <label className="admin-field">
          <span>Набор</span>
          <select
            value={enrollmentStatus}
            onChange={(event) => setEnrollmentStatus(event.target.value)}
          >
            <option value="PAUSED">Paused</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
          </select>
        </label>

        <label className="admin-field">
          <span>Уровень</span>
          <input
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            placeholder="Начальный / средний"
          />
        </label>

        <label className="admin-field">
          <span>Дата начала</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>

        <label className="admin-field">
          <span>Дата окончания</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>

        <label className="admin-field">
          <span>Начало тренировки</span>
          <input
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>

        <label className="admin-field">
          <span>Конец тренировки</span>
          <input
            type="time"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>

        <label className="admin-field admin-field-wide">
          <span>Внутренние заметки</span>
          <textarea
            rows={3}
            value={notesInternal}
            onChange={(event) => setNotesInternal(event.target.value)}
            placeholder="Не публикуются на сайте."
          />
        </label>
      </div>

      <div className="admin-schedule-block">
        <div className="admin-schedule-head">
          <div>
            <strong>Дни тренировок</strong>
            <small>Для выбранных дней используется одно время.</small>
          </div>
        </div>
        <div className="admin-day-picker">
          {weekdays.map(([value, label]) => (
            <label key={value}>
              <input
                type="checkbox"
                checked={days.includes(value)}
                onChange={() => toggleDay(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="admin-editor-actions">
        <button
          className="button primary"
          disabled={
            state === "saving" ||
            days.length === 0 ||
            !branchId ||
            !sportId ||
            !primaryCoachId
          }
        >
          {state === "saving" ? "Создаём…" : "Создать группу"}
        </button>

        {message ? (
          <span
            className={
              state === "error"
                ? "admin-save-message error"
                : "admin-save-message"
            }
          >
            {message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
