import { useEffect, useMemo, useState } from "react";
import { CARDS, TOPICS, type Card } from "@/data/cards";
import { gradeRecall } from "@/lib/grade";
import {
  loadStatus,
  saveStatus,
  shuffle,
  type CardStatus,
  type StatusMap,
} from "@/lib/progress";

type Mode = "choice" | "recall";
type View = "remaining" | "work";
type Result = { ok: boolean; given: string };

function pool(status: StatusMap, topic: string, view: View, review: boolean): Card[] {
  return CARDS.filter((card) => {
    if (topic !== "All" && card.topic !== topic) return false;
    if (review) return true;
    if (status[card.id] === "known") return false;
    if (view === "work" && status[card.id] !== "work") return false;
    return true;
  });
}

export function StudyApp() {
  const [status, setStatus] = useState<StatusMap>({});
  const [topic, setTopic] = useState("All");
  const [view, setView] = useState<View>("remaining");
  const [mode, setMode] = useState<Mode>("choice");
  const [review, setReview] = useState(false);
  const [queue, setQueue] = useState<readonly Card[]>([CARDS[0] as Card]);
  const [pos, setPos] = useState(0);
  const [options, setOptions] = useState<readonly string[]>(CARDS[0]?.choices ?? []);
  const [typed, setTyped] = useState("");
  const [needText, setNeedText] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [session, setSession] = useState({ correct: 0, attempts: 0 });
  const [confirmClear, setConfirmClear] = useState(false);
  const [booted, setBooted] = useState(false);

  function open(card: Card | undefined) {
    setTyped("");
    setNeedText(false);
    setResult(null);
    setOptions(card ? shuffle(card.choices) : []);
  }

  function deal(nextStatus: StatusMap, nextTopic: string, nextView: View, nextReview: boolean) {
    const nextQueue = shuffle(pool(nextStatus, nextTopic, nextView, nextReview));
    setQueue(nextQueue);
    setPos(0);
    setReview(nextReview);
    open(nextQueue[0]);
  }

  useEffect(() => {
    const saved = loadStatus();
    setStatus(saved);
    deal(saved, "All", "remaining", false);
    setBooted(true);
    // Mount-only restore. deal is stable enough for the first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = pos >= 0 && pos < queue.length ? queue[pos] : undefined;
  const finished = booted && !current;

  const counts = useMemo(() => {
    let known = 0;
    let work = 0;
    for (const card of CARDS) {
      if (status[card.id] === "known") known += 1;
      if (status[card.id] === "work") work += 1;
    }
    return { known, work, left: CARDS.length - known };
  }, [status]);

  function grade(given: string, ok: boolean) {
    setResult({ ok, given });
    setNeedText(false);
    setSession((prev) => ({
      correct: prev.correct + (ok ? 1 : 0),
      attempts: prev.attempts + 1,
    }));
  }

  function choose(choice: string) {
    if (!current || result) return;
    grade(choice, choice === current.answer);
  }

  function checkTyped() {
    if (!current || result) return;
    if (!typed.trim()) {
      setNeedText(true);
      return;
    }
    grade(typed.trim(), gradeRecall(typed, current));
  }

  function tag(kind: CardStatus) {
    if (!current) return;
    setStatus((prev) => {
      const next = { ...prev };
      if (next[current.id] === kind) delete next[current.id];
      else next[current.id] = kind;
      saveStatus(next);
      return next;
    });
    setConfirmClear(false);
  }

  function next() {
    const following = pos + 1;
    if (following >= queue.length) {
      setPos(queue.length);
      setResult(null);
      return;
    }
    setPos(following);
    open(queue[following]);
  }

  function onShuffle() {
    deal(status, topic, view, false);
  }

  function onReviewKnown() {
    deal(status, topic, view, true);
  }

  function onTopic(nextTopic: string) {
    setTopic(nextTopic);
    deal(status, nextTopic, view, false);
  }

  function onView(nextView: View) {
    setView(nextView);
    deal(status, topic, nextView, false);
  }

  function onMode(nextMode: Mode) {
    setMode(nextMode);
    if (current) open(current);
  }

  function clearTags() {
    setStatus({});
    saveStatus({});
    setConfirmClear(false);
    setReview(false);
    deal({}, topic, "remaining", false);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (event.key === "Enter" && mode === "recall") return;
      if (typing) return;
      if (!current) {
        if (event.key.toLowerCase() === "s") onShuffle();
        return;
      }
      if (!result && mode === "choice" && ["1", "2", "3", "4"].includes(event.key)) {
        const choice = options[Number(event.key) - 1];
        if (choice) choose(choice);
      }
      if (result && event.key.toLowerCase() === "k") tag("known");
      if (result && event.key.toLowerCase() === "w") tag("work");
      if (event.key === "n" || event.key === "N" || event.key === "ArrowRight") next();
      if (event.key.toLowerCase() === "s" && !event.metaKey && !event.ctrlKey) onShuffle();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const tagState = current ? status[current.id] : undefined;

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-12">
      <header className="mb-4 flex items-start gap-4 sm:mb-6">
        <Mark />
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-widest text-brass uppercase">
            BIOL 1414 · Lecture 9 · 7–8 Oct 2026
          </p>
          <h1 className="font-display text-4xl leading-tight font-semibold text-balance text-ink sm:text-5xl">
            Respire Cards
          </h1>
          <p className="mt-2 max-w-xl text-base text-pretty text-muted">
            Cellular respiration, from the lecture. Answer the card, then tag it. Known cards stay
            out of the next shuffle.
          </p>
        </div>
      </header>

      <section className="mb-4 rounded-2xl border border-line bg-card px-4 py-3">
        <div className="mb-2 flex h-1.5 overflow-hidden rounded-full bg-paper-deep" aria-hidden>
          <div
            className="bg-pine"
            style={{ width: `${(counts.known / CARDS.length) * 100}%` }}
          />
          <div
            className="bg-clay"
            style={{ width: `${(counts.work / CARDS.length) * 100}%` }}
          />
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted tabular-nums">
          <span>
            <strong className="font-semibold text-ink">{counts.left}</strong> still in play
          </span>
          <span>
            <strong className="font-semibold text-pine">{counts.known}</strong> known
          </span>
          <span>
            <strong className="font-semibold text-clay">{counts.work}</strong> need work
          </span>
          <span>
            {session.attempts > 0
              ? `${session.correct}/${session.attempts} correct this sitting`
              : `${CARDS.length} cards`}
          </span>
        </p>
      </section>

      <label className="mb-3 flex min-h-11 items-center gap-3 sm:hidden">
        <span className="text-sm font-medium text-muted">Topic</span>
        <select
          value={topic}
          onChange={(event) => onTopic(event.target.value)}
          className="min-h-11 flex-1 rounded-full border border-line bg-card px-3 text-base text-ink"
        >
          <option value="All">All topics</option>
          {TOPICS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <div className="mb-3 hidden flex-wrap gap-2 sm:flex">
        <FilterChip active={topic === "All"} onClick={() => onTopic("All")}>
          All topics
        </FilterChip>
        {TOPICS.map((item) => (
          <FilterChip key={item} active={topic === item} onClick={() => onTopic(item)}>
            {item}
          </FilterChip>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Segment
          label="Deck"
          value={view}
          onChange={onView}
          options={[
            ["remaining", "Remaining"],
            ["work", "Needs work"],
          ]}
        />
        <Segment
          label="Answer by"
          value={mode}
          onChange={onMode}
          options={[
            ["choice", "Choices"],
            ["recall", "Typing"],
          ]}
        />
        <button
          type="button"
          onClick={onShuffle}
          className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-medium text-ink"
        >
          Shuffle
        </button>
      </div>

      {finished ? (
        <Done
          emptyPool={queue.length === 0}
          view={view}
          topic={topic}
          known={counts.known}
          left={counts.left}
          work={counts.work}
          onShuffle={onShuffle}
          onReview={onReviewKnown}
          onWork={() => onView("work")}
        />
      ) : current ? (
        <article className="deck-card relative overflow-hidden rounded-2xl border border-line bg-card">
          <span className="absolute inset-y-0 left-0 w-1.5 bg-pine" aria-hidden />
          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <p className="text-xs font-medium tracking-widest text-brass uppercase">
                {current.topic}
                {review ? " · reviewing known" : ""}
              </p>
              <p className="text-sm text-muted tabular-nums">
                {pos + 1} / {queue.length}
              </p>
            </div>
            <h2 className="font-display text-3xl leading-tight font-semibold text-balance break-words text-ink">
              {current.prompt}
            </h2>

            {tagState ? (
              <p className="mt-3 text-sm font-medium text-muted">
                {tagState === "known"
                  ? "Tagged known. A normal shuffle will skip it."
                  : "Tagged needs work. It stays in the deck."}
              </p>
            ) : null}

            {mode === "choice" ? (
              <div className="mt-6 grid gap-2.5" role="group" aria-label="Answer choices">
                {options.map((choice, index) => {
                  const picked = result?.given === choice;
                  const correct = choice === current.answer;
                  let tone = "border-line bg-card hover:bg-paper";
                  if (result && correct) tone = "border-pine bg-pine-soft";
                  else if (result && picked) tone = "border-clay bg-clay-soft";
                  else if (result) tone = "border-line bg-card text-muted";
                  return (
                    <button
                      key={choice}
                      type="button"
                      disabled={Boolean(result)}
                      onClick={() => choose(choice)}
                      className={`flex min-h-12 items-start gap-3 rounded-xl border px-3 py-3 text-left text-base disabled:cursor-default ${tone}`}
                    >
                      <span className="mt-0.5 w-6 shrink-0 font-medium text-brass tabular-nums">
                        {index + 1}
                      </span>
                      <span>{choice}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <form
                className="mt-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  checkTyped();
                }}
              >
                <label htmlFor="recall" className="mb-2 block text-sm font-medium text-muted">
                  Type the answer
                </label>
                <input
                  id="recall"
                  value={typed}
                  disabled={Boolean(result)}
                  onChange={(event) => {
                    setTyped(event.target.value);
                    setNeedText(false);
                  }}
                  autoComplete="off"
                  placeholder="A short phrase is enough"
                  className="min-h-12 w-full rounded-xl border border-line bg-paper px-4 text-base text-ink placeholder:text-muted/70"
                />
                {needText ? (
                  <p className="mt-2 text-sm font-medium text-clay">Type an answer to check it.</p>
                ) : null}
                {!result ? (
                  <button
                    type="submit"
                    className="mt-3 min-h-11 rounded-full bg-pine px-5 text-sm font-semibold text-paper"
                  >
                    Check answer
                  </button>
                ) : null}
              </form>
            )}

            <div aria-live="polite" className="mt-5">
              {result ? (
                <div
                  className={`rounded-xl px-4 py-4 ${result.ok ? "bg-pine text-paper" : "bg-clay text-paper"}`}
                >
                  <p className="font-display text-2xl font-semibold">
                    {result.ok ? "Correct" : "Incorrect"}
                  </p>
                  <p className="mt-1 text-base">
                    {result.ok ? current.answer : `Answer: ${current.answer}`}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-paper/90">{current.why}</p>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  {mode === "choice"
                    ? "Pick a choice. Keys 1–4 work too."
                    : "Check your phrase against the lecture wording."}
                </p>
              )}
            </div>

            {result ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <TagButton
                  pressed={tagState === "known"}
                  tone="pine"
                  onClick={() => tag("known")}
                >
                  I know this
                </TagButton>
                <TagButton pressed={tagState === "work"} tone="clay" onClick={() => tag("work")}>
                  Needs work
                </TagButton>
              </div>
            ) : null}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={next}
                className={`min-h-11 rounded-full px-5 text-sm font-semibold ${
                  result ? "bg-ink text-paper" : "border border-line bg-card text-ink"
                }`}
              >
                {result ? "Next card" : "Skip"}
              </button>
            </div>
          </div>
        </article>
      ) : null}

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p>Known cards are left out of later shuffles. Needs-work cards stay in.</p>
        {confirmClear ? (
          <span className="flex gap-2">
            <button
              type="button"
              onClick={clearTags}
              className="min-h-11 rounded-full bg-clay px-4 font-semibold text-paper"
            >
              Clear all tags
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="min-h-11 rounded-full border border-line bg-card px-4 text-ink"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="min-h-11 rounded-full px-2 font-medium text-ink underline decoration-line underline-offset-4"
          >
            Clear tags
          </button>
        )}
      </footer>
    </main>
  );
}

function Done({
  emptyPool,
  view,
  topic,
  known,
  left,
  work,
  onShuffle,
  onReview,
  onWork,
}: {
  emptyPool: boolean;
  view: View;
  topic: string;
  known: number;
  left: number;
  work: number;
  onShuffle: () => void;
  onReview: () => void;
  onWork: () => void;
}) {
  const cleared = known === CARDS.length;
  const emptyWork = view === "work" && work === 0;
  const title = !emptyPool
    ? cleared
      ? "Every card is marked known."
      : "This shuffle is finished."
    : cleared
      ? "Every card is marked known."
      : emptyWork
        ? "Nothing is tagged needs work."
        : topic !== "All"
          ? `Nothing left in ${topic}.`
          : "Nothing left to shuffle.";
  const detail = !emptyPool
    ? `${left} card${left === 1 ? "" : "s"} still not marked known. Shuffle again and the known ones stay out.`
    : cleared
      ? "A normal shuffle stays empty until you clear a tag or review the known cards on purpose."
      : emptyWork
        ? "Tag a missed card as needs work and it will gather here. Known cards stay out either way."
        : "Known cards stay out of the next shuffle. Switch topic or clear a tag to bring cards back.";
  return (
    <section className="rounded-2xl border border-line bg-card px-6 py-10 sm:px-10">
      <p className="text-xs font-medium tracking-widest text-brass uppercase">End of this pass</p>
      <h2 className="font-display mt-2 text-4xl leading-tight font-semibold text-balance">{title}</h2>
      <p className="mt-3 max-w-lg text-base text-pretty text-muted">{detail}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onShuffle}
          className="min-h-11 rounded-full bg-pine px-5 text-sm font-semibold text-paper"
        >
          Shuffle remaining
        </button>
        {work > 0 && view !== "work" ? (
          <button
            type="button"
            onClick={onWork}
            className="min-h-11 rounded-full border border-line bg-card px-5 text-sm font-semibold text-ink"
          >
            Drill needs work
          </button>
        ) : null}
        {known > 0 ? (
          <button
            type="button"
            onClick={onReview}
            className="min-h-11 rounded-full border border-line bg-card px-5 text-sm font-semibold text-ink"
          >
            Review known
          </button>
        ) : null}
      </div>
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-full px-3 text-sm font-medium ${
        active ? "bg-ink text-paper" : "border border-line bg-card text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Segment<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
}) {
  return (
    <div
      className="flex min-h-11 items-center rounded-full border border-line bg-card p-1"
      role="group"
      aria-label={label}
    >
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={`min-h-9 rounded-full px-3 text-sm font-medium ${
            value === id ? "bg-pine text-paper" : "text-ink"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function TagButton({
  pressed,
  tone,
  onClick,
  children,
}: {
  pressed: boolean;
  tone: "pine" | "clay";
  onClick: () => void;
  children: string;
}) {
  const on = tone === "pine" ? "bg-pine text-paper" : "bg-clay text-paper";
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`min-h-12 rounded-xl border px-4 text-sm font-semibold ${
        pressed ? on : "border-line bg-card text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Mark() {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden
      className="mt-1 size-12 shrink-0 text-pine"
    >
      <rect x="1" y="1" width="46" height="46" rx="12" fill="currentColor" />
      <ellipse cx="24" cy="24" rx="14" ry="9" fill="none" stroke="var(--color-paper)" strokeWidth="1.8" />
      <path
        d="M12.5 24.4c2.8-3.2 4.8-3.2 7 0s4.2 3.2 7 0 4.2-3.2 7.8 0"
        fill="none"
        stroke="var(--color-paper)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
