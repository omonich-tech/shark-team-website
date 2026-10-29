type AdminErrorPayload = {
  error?: string;
  dependencies?: {
    activeGroups?: number;
    groups?: Array<{ id?: string; internalName?: string }>;
  };
};

const ERROR_MESSAGES: Record<string, string> = {
  BRANCH_SPORT_IN_USE:
    "Нельзя убрать этот вид спорта: связь используется группой. Сначала перенесите или архивируйте связанную группу.",
  BRANCH_COACH_IN_USE:
    "Нельзя убрать тренера из филиала: связь используется группой. Сначала назначьте группе другого тренера или архивируйте группу.",
  COACH_SPORT_IN_USE:
    "Нельзя убрать вид спорта у тренера: тренер ведёт связанную группу. Сначала измените тренера или спорт у группы.",
  COACH_BRANCH_IN_USE:
    "Нельзя убрать филиал у тренера: тренер ведёт там связанную группу. Сначала перенесите группу или назначьте другого тренера.",
  BRANCH_HAS_ACTIVE_GROUPS:
    "Нельзя отключить филиал, пока в нём есть активные группы. Сначала приостановите, перенесите или архивируйте их.",
  SPORT_HAS_ACTIVE_GROUPS:
    "Нельзя отключить вид спорта, пока по нему есть активные группы. Сначала приостановите или архивируйте их.",
  COACH_HAS_ACTIVE_GROUPS:
    "Нельзя отключить тренера, пока он назначен основным тренером активной группы. Сначала переназначьте или приостановите группу.",
  ACTIVE_GROUP_REQUIRES_ACTIVE_RELATIONS:
    "Активную группу можно сохранить только с активными филиалом, видом спорта и тренером.",
  PRICE_SCOPE_RELATION_INACTIVE:
    "Цена не сохранена: выбранный вид спорта не связан с этим филиалом активной связью.",
  FAQ_SCOPE_RELATION_INACTIVE:
    "FAQ не сохранён: выбранный вид спорта не связан с этим филиалом активной связью."
};

export function adminApiErrorMessage(
  payload: AdminErrorPayload | null | undefined,
  fallback: string
) {
  const code = payload?.error;
  if (!code) return fallback;

  const base = ERROR_MESSAGES[code] ?? code;
  const groups = payload?.dependencies?.groups?.filter(
    (group) => group.internalName || group.id
  );

  if (groups?.length) {
    const names = groups
      .slice(0, 3)
      .map((group) => group.internalName || group.id)
      .join(", ");
    return `${base} Связанные группы: ${names}${groups.length > 3 ? "…" : ""}`;
  }

  return base;
}
