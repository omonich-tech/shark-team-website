const criteria = [
  ["ability", "Навыки"],
  ["discipline", "Дисциплина"],
  ["motivation", "Мотивация"],
  ["coordination", "Координация"],
  ["physicalPreparation", "Физподготовка"],
  ["psychologicalReadiness", "Психологическая готовность"]
] as const;

type Scores = {
  ability: number;
  discipline: number;
  motivation: number;
  coordination: number;
  physicalPreparation: number;
  psychologicalReadiness: number;
};

type AssessmentPoint = Scores & {
  assessedAt: Date;
};

function shortDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tashkent"
  }).format(value);
}

function average(scores: Scores) {
  return (
    (scores.ability +
      scores.discipline +
      scores.motivation +
      scores.coordination +
      scores.physicalPreparation +
      scores.psychologicalReadiness) /
    6
  );
}

export function ProgressTrendChart({
  baseline,
  assessments
}: {
  baseline: Scores | null;
  assessments: AssessmentPoint[];
}) {
  const regular = [...assessments]
    .sort((a, b) => a.assessedAt.getTime() - b.assessedAt.getTime())
    .slice(0, 3);

  const points: Array<{
    key: string;
    label: string;
    date: string;
    scores: Scores;
  }> = [];

  if (baseline) {
    points.push({
      key: "baseline",
      label: "Пробное",
      date: "Старт",
      scores: baseline
    });
  }

  regular.forEach((item, index) => {
    points.push({
      key: "m" + (index + 1),
      label: "М" + (index + 1),
      date: shortDate(item.assessedAt),
      scores: item
    });
  });

  if (points.length === 0) {
    return <div className="coach-empty">Для графика пока нет оценок.</div>;
  }

  return (
    <div className="progress-trend">
      <div className="progress-trend-head">
        <div>
          <span>Показатель</span>
        </div>
        {points.map((point) => (
          <div key={point.key}>
            <strong>{point.label}</strong>
            <small>{point.date}</small>
            <em>{average(point.scores).toFixed(1)}</em>
          </div>
        ))}
      </div>

      {criteria.map(([key, label]) => (
        <div className="progress-trend-row" key={key}>
          <strong>{label}</strong>
          {points.map((point) => {
            const score = point.scores[key];
            return (
              <div className="progress-trend-cell" key={point.key}>
                <span className="progress-trend-track">
                  <span
                    className="progress-trend-fill"
                    style={{ width: score * 20 + "%" }}
                  />
                </span>
                <b>{score}/5</b>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
