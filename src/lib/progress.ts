export type CardStatus = "known" | "work";
export type StatusMap = Record<string, CardStatus>;

export const PROGRESS_KEY = "respire-cards-v1";

type Saved = { status?: Record<string, string> };

export function loadStatus(): StatusMap {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Saved;
    const next: StatusMap = {};
    for (const [id, value] of Object.entries(parsed.status ?? {})) {
      if (value === "known" || value === "work") next[id] = value;
    }
    return next;
  } catch {
    return {};
  }
}

export function saveStatus(status: StatusMap): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ status }));
}

export function shuffle<T>(list: readonly T[]): T[] {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swap] as T;
    copy[swap] = current as T;
  }
  return copy;
}
