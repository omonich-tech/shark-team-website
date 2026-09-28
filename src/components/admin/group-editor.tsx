"use client";

import { FormEvent, useState } from "react";

type ScheduleRow = {
  weekday: string;
  start: string;
  end: string;
};

const weekdayOptions = [
  ["MONDAY", "Понедельник"],
  ["TUESDAY", "Вторник"],
  ["WEDNESDAY", "Среда"],
  ["THURSDAY", "Четверг"],
  ["FRIDAY", "Пятница"],
  ["SATURDAY", "Суббота"],
  ["SUNDAY", "Воскресенье"]
] as const;

export function GroupEditor({
  group
}: {
  group: {
    id: string;
    ageMin: number;
    ageMax: number;
    capacityRegular: number;
    capacityTrial: number | null;
    status: string;
    enrollmentStatus: string;
    schedule: ScheduleRow[];
  };
}) {
  const [ageMin, setAgeMin] = useState(group.ageMin);
  const [ageMax, setAgeMax] = useState(group.ageMax);
  const [capacityRegular, setCapacityRegular] = useState(
    group.capacityRegular
  );
  const [capacityTrial, setCapacityTrial] = useState<number | "">(
    group.capacityTrial ?? ""
  );
  const [status, setStatus] = useState(group.status);
  const [enrollmentStatus, setEnrollmentStatus] = useState(
    group.enrollmentStatus
  );
  const [schedule, setSchedule] = useState(group.schedule);
  const [state, setState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  function updateSchedule(
    index: number,
    patch: Partial<ScheduleRow>
  ) {
    setSchedule((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      )
    );
    setState("idle");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/groups/${group.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ageMin,
            ageMax,
            capacityRegular,
            capacityTrial:
              capacityTrial === "" ? null : capacityTrial,
            status,
            enrollmentStatus,
            schedule
          })
        }
      );

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage(
          payload.error === "FUTURE_SESSIONS_HAVE_BOOKINGS"
            ? "Расписание нельзя массово менять: есть будущие пробные брони."
            : payload.error ?? "Не удалось сохранить группу."
        );
        return;
      }

      setState("saved");
      setMessage("Группа и будущие Sessions обновлены.");
    } catch {
      setState("error");
      setMessage("Не удалось сохранить группу.");
    }
  }

  return (
    <form className="admin-group-editor" onSubmit={submit}>
      <div className="admin-group-summary">
        <strong>
          {ageMin}–{ageMax} лет
        </strong>
        <span>{group.id}</span>
      </div>

      <div className="admin-editor-grid">
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
          <span>Вместимость группы</span>
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
          <span>Мест для пробных / Session</span>
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
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>

        <label className="admin-field">
          <span>Набор</span>
          <select
            value={enrollmentStatus}
            onChange={(event) =>
              setEnrollmentStatus(event.target.value)
            }
          >
            <option value="OPEN">Open</option>
            <option value="PAUSED">Paused</option>
            <option value="CLOSED">Closed</option>
          </select>
        </label>
      </div>

      <div className="admin-schedule-editor">
        <div className="admin-schedule-head">
          <strong>Регулярное расписание</strong>
          <button
            type="button"
            onClick={() =>
              setSchedule((current) => [
                ...current,
                {
                  weekday: "TUESDAY",
                  start: "17:00",
                  end: "18:00"
                }
              ])
            }
          >
            + День
          </button>
        </div>

        {schedule.map((row, index) => (
          <div
            className="admin-schedule-row"
            key={`${index}-${row.weekday}`}
          >
            <select
              value={row.weekday}
              onChange={(event) =>
                updateSchedule(index, {
                  weekday: event.target.value
                })
              }
            >
              {weekdayOptions.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>

            <input
              type="time"
              value={row.start}
              onChange={(event) =>
                updateSchedule(index, {
                  start: event.target.value
                })
              }
            />

            <input
              type="time"
              value={row.end}
              onChange={(event) =>
                updateSchedule(index, {
                  end: event.target.value
                })
              }
            />

            <button
              type="button"
              className="admin-danger-link"
              disabled={schedule.length <= 1}
              onClick={() =>
                setSchedule((current) =>
                  current.filter(
                    (_item, rowIndex) => rowIndex !== index
                  )
                )
              }
            >
              Удалить
            </button>
          </div>
        ))}
      </div>

      <div className="admin-editor-actions">
        <button className="button primary" disabled={state === "saving"}>
          {state === "saving" ? "Сохраняем…" : "Сохранить группу"}
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
