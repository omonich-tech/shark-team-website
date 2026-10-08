"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type ScheduleRow = {
  weekday: string;
  start: string;
  end: string;
};

type Option = {
  id: string;
  name: string;
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
  group,
  branches,
  sports,
  coaches
}: {
  group: {
    id: string;
    branchId: string;
    sportId: string;
    primaryCoachId: string;
    internalName: string;
    ageMin: number;
    ageMax: number;
    capacityRegular: number;
    capacityTrial: number | null;
    status: string;
    enrollmentStatus: string;
    level: string | null;
    notesInternal: string | null;
    startDate: string | null;
    endDate: string | null;
    schedule: ScheduleRow[];
  };
  branches: Option[];
  sports: Option[];
  coaches: Option[];
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(group.branchId);
  const [sportId, setSportId] = useState(group.sportId);
  const [primaryCoachId, setPrimaryCoachId] = useState(
    group.primaryCoachId
  );
  const [internalName, setInternalName] = useState(group.internalName);
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
  const [level, setLevel] = useState(group.level ?? "");
  const [notesInternal, setNotesInternal] = useState(
    group.notesInternal ?? ""
  );
  const [startDate, setStartDate] = useState(group.startDate ?? "");
  const [endDate, setEndDate] = useState(group.endDate ?? "");
  const [schedule, setSchedule] = useState(group.schedule);
  const [state, setState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const relationChanged = useMemo(
    () =>
      branchId !== group.branchId ||
      sportId !== group.sportId ||
      primaryCoachId !== group.primaryCoachId,
    [
      branchId,
      group.branchId,
      group.primaryCoachId,
      group.sportId,
      primaryCoachId,
      sportId
    ]
  );

  function updateSchedule(index: number, patch: Partial<ScheduleRow>) {
    setSchedule((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      )
    );
    setState("idle");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/groups/${group.id}`, {
        method: "PATCH",
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
          schedule
        })
      });

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage(
          payload.error === "FUTURE_SESSIONS_HAVE_BOOKINGS"
            ? "Изменение расписания, филиала или дат заблокировано: есть будущие занятия с бронями/посещаемостью."
            : payload.error === "INVALID_GROUP_DATE_RANGE"
              ? "Дата окончания не может быть раньше даты начала."
              : payload.error ?? "Не удалось сохранить группу."
        );
        return;
      }

      setState("saved");
      setMessage("Группа сохранена. Будущие занятия синхронизированы.");
      router.refresh();
    } catch {
      setState("error");
      setMessage("Не удалось сохранить группу.");
    }
  }

  return (
    <form className="admin-group-editor" onSubmit={submit}>
      <div className="admin-group-summary">
        <div>
          <strong>
            {ageMin}–{ageMax} лет
          </strong>
          <span>{group.id}</span>
        </div>
        {relationChanged ? (
          <em>Изменены основные связи группы</em>
        ) : null}
      </div>

      <div className="admin-editor-grid">
        <label className="admin-field">
          <span>Внутреннее название</span>
          <input
            required
            value={internalName}
            onChange={(event) => setInternalName(event.target.value)}
          />
        </label>

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
          <span>Мест для пробных / занятие</span>
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
            <option value="DRAFT">Draft</option>
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

      <div className="admin-schedule-editor">
        <div className="admin-schedule-head">
          <div>
            <strong>Регулярное расписание</strong>
            <small>
              Изменение расписания пересобирает только безопасные будущие занятия.
            </small>
          </div>
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
