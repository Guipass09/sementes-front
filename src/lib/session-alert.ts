export const BLINK_BEFORE_MINUTES = 30;
export const BLINK_AFTER_MINUTES = 10;

export function getTodayYMD(nowMs: number): string {
  const d = new Date(nowMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDateTime(dateYMD: string, timeHHmm: string): number | null {
  if (!dateYMD || !timeHHmm) return null;
  const t = timeHHmm.slice(0, 5);
  const [hh, mm] = t.split(":").map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const d = new Date(dateYMD + "T00:00:00");
  d.setHours(hh, mm, 0, 0);
  return d.getTime();
}

export function getJoinCountdownLabel(params: {
  date: string;
  time: string;
  nowMs: number;
}): { active: boolean; label: string | null } {
  const startMs = parseLocalDateTime(params.date, params.time);
  if (startMs === null) return { active: false, label: null };
  const availableFrom = startMs - 10 * 60_000;
  if (params.nowMs < availableFrom) return { active: false, label: null };
  if (params.nowMs < startMs) {
    const remainingSec = Math.max(0, Math.ceil((startMs - params.nowMs) / 1000));
    const mm = String(Math.floor(remainingSec / 60)).padStart(2, "0");
    const ss = String(remainingSec % 60).padStart(2, "0");
    return { active: true, label: `${mm}:${ss}` };
  }
  return { active: true, label: "Sessão começou" };
}

export function computeTodaySessionAlert<T extends { date: string; time: string }>(params: {
  sessions: T[];
  todayYMD: string;
  nowMs: number;
  beforeMinutes?: number;
  afterMinutes?: number;
}): { show: boolean; blink: boolean; nextSession: T | null } {
  const before = (params.beforeMinutes ?? BLINK_BEFORE_MINUTES) * 60_000;
  const after = (params.afterMinutes ?? BLINK_AFTER_MINUTES) * 60_000;

  const todays = (params.sessions || [])
    .filter((s) => s.date === params.todayYMD && !!s.time)
    .slice()
    .sort((a, b) => (`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)));

  if (todays.length === 0) return { show: false, blink: false, nextSession: null };

  let blink = false;
  for (const s of todays) {
    const startMs = parseLocalDateTime(s.date, s.time);
    if (startMs === null) continue;
    if (params.nowMs >= startMs - before && params.nowMs <= startMs + after) {
      blink = true;
      break;
    }
  }

  const nextSession =
    todays.find((s) => {
      const startMs = parseLocalDateTime(s.date, s.time);
      return startMs !== null && startMs >= params.nowMs;
    }) || todays[0];

  return { show: true, blink, nextSession };
}


