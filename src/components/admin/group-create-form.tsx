"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const weekdays = [
  ["MONDAY", "Пн"], ["TUESDAY", "Вт"], ["WEDNESDAY", "Ср"],
  ["THURSDAY", "Чт"], ["FRIDAY", "Пт"], ["SATURDAY", "Сб"], ["SUNDAY", "Вс"]
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
  const [days, setDays] = useState<string[]>(["TUESDAY", "THURSDAY", "SATURDAY"]);
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("18:00");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
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
          status: "DRAFT",
          enrollmentStatus: "PAUSED",
          schedule: days.map((weekday) => ({ weekday, start, end }))
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage(payload.error ?? "Не удалось создать группу.");
        return;
      }

      setState("saved");
      setMessage("Группа создана в Draft. Проверьте её и откройте набор.");
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
        <label className="admin-field"><span>Филиал</span>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label className="admin-field"><span>Спорт</span>
          <select value={sportId} onChange={(e) => setSportId(e.target.value)}>
            {sports.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label className="admin-field"><span>Тренер</span>
          <select value={primaryCoachId} onChange={(e) => setPrimaryCoachId(e.target.value)}>
            {coaches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label className="admin-field"><span>Внутреннее название</span>
          <input required value={internalName} onChange={(e) => setInternalName(e.target.value)} />
        </label>
        <label className="admin-field"><span>Возраст от</span>
          <input type="number" min={3} max={19} value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))} />
        </label>
        <label className="admin-field"><span>Возраст до</span>
          <input type="number" min={3} max={19} value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} />
        </label>
        <label className="admin-field"><span>Вместимость</span>
          <input type="number" min={1} max={100} value={capacityRegular} onChange={(e) => setCapacityRegular(Number(e.target.value))} />
        </label>
        <label className="admin-field"><span>Пробных мест / Session</span>
          <input type="number" min={0} max={30} placeholder="Не задано" value={capacityTrial}
            onChange={(e) => setCapacityTrial(e.target.value === "" ? "" : Number(e.target.value))} />
        </label>
        <label className="admin-field"><span>Начало</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="admin-field"><span>Конец</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>

      <div className="admin-day-picker">
        {weekdays.map(([value, label]) => (
          <label key={value}>
            <input type="checkbox" checked={days.includes(value)} onChange={() => toggleDay(value)} />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="admin-editor-actions">
        <button className="button primary" disabled={state === "saving" || days.length === 0}>
          {state === "saving" ? "Создаём…" : "Создать группу"}
        </button>
        {message ? <span className={state === "error" ? "admin-save-message error" : "admin-save-message"}>{message}</span> : null}
      </div>
    </form>
  );
}