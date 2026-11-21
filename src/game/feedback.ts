import type { ReviewStep } from "./review"

export const questSteps: { label: string; completed: ReviewStep[] }[] = [
  { label: "Запустить проверку", completed: ["locate", "patch", "retest", "stamp", "released"] },
  { label: "Найти уязвимую строку", completed: ["patch", "retest", "stamp", "released"] },
  { label: "Проверить исправление", completed: ["stamp", "released"] },
  { label: "Подтвердить выпуск", completed: ["released"] },
]

export const characters = {
  developer: { name: "Денис", role: "Middle-разработчик" },
  mentor: { name: "Макс", role: "Senior AppSec" },
}

export type Mood = "smile" | "alarmed" | "shocked" | "calm" | "guiding" | "approve"
export type Message = { author: keyof typeof characters; mood: Mood; text: string }

export const mentorGreeting: Message = { author: "mentor", mood: "calm", text: "Сначала проверка, потом аплодисменты. Если застрянешь, подскажу, куда смотреть." }
export const tutorialComplete: Message = {
  author: "mentor", mood: "approve",
  text: "Отлично, принцип ты понял. Дальше работаешь сам — если застрянешь, жми «Спросить Макса».",
}

export const reactions = {
  discovery: { author: "developer", mood: "alarmed", text: "Ключ в браузере?! Нейронка же сказала, что всё чисто! Успеем поправить?" },
  evidence: { author: "mentor", mood: "guiding", text: "Улика на месте. Теперь выбери исправление и проверь, что покупатель всё ещё может заплатить." },
  security: { author: "developer", mood: "alarmed", text: "Я думал, нейронка разрулила! Проверка всё ещё видит ключ. Времени в обрез!!" },
  feature: { author: "developer", mood: "shocked", text: "Прод горит!! Оплата сломалась, чек не приходит. Нам это ещё показывать!" },
  clean: { author: "mentor", mood: "approve", text: "Обе проверки зелёные. Теперь у тебя есть основания выпускать обновление." },
  release: { author: "developer", mood: "smile", text: "Выпустили!! Оплата работает, можно показывать на стриме!" },
} satisfies Record<string, Message>

export const achievements = {
  skeptical: { title: "Не верю ИИ", detail: "Обнаружена первая уязвимость за зелёным бейджем ИИ." },
  independent: { title: "Чистая работа", detail: "Задача выпущена без подсказки Макса." },
  precise: { title: "Хирургический фикс", detail: "Уязвимость закрыта, функция по-прежнему работает." },
  streak: { title: "Серия без ошибок", detail: "Две разные задачи подряд выпущены без потерь метрик." },
  shift: { title: "Смена закрыта", detail: "Все задачи главы выпущены." },
}

export type Achievement = keyof typeof achievements
type Metrics = { security: number; stability: number }
type Run = Metrics & { hint: boolean; flawless: boolean }
export type Feedback = {
  sound: boolean
  tutorialDismissed: boolean
  earned: Achievement[]
  completed: string[]
  streak: number
  run: Run
}
export type FeedbackEvent = keyof typeof reactions | "hint" | "restart"

const changes: Partial<Record<FeedbackEvent, Metrics>> = {
  discovery: { security: 5, stability: 0 },
  security: { security: -20, stability: 0 },
  feature: { security: 0, stability: -20 },
  clean: { security: 10, stability: 10 },
}
const initialRun: Run = { security: 80, stability: 85, hint: false, flawless: true }
const initial: Feedback = { sound: false, tutorialDismissed: false, earned: [], completed: [], streak: 0, run: initialRun }
const metric = (value: number) => Math.max(0, Math.min(value, 100))
const validMetric = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100

export function readFeedback(saved: string | null, ticketIds: string[], task: string, resume: boolean): Feedback {
  try {
    const data = JSON.parse(saved ?? "null")
    if (!data || data.version !== 1) return initial
    const earned: Achievement[] = Array.isArray(data.earned)
      ? [...new Set<Achievement>(data.earned.filter((id: unknown) => typeof id === "string" && Object.hasOwn(achievements, id)))]
      : []
    const completed: string[] = Array.isArray(data.completed)
      ? [...new Set<string>(data.completed.filter((id: unknown) => typeof id === "string" && ticketIds.includes(id)))]
      : []
    const run = data.run
    return {
      sound: data.sound === true,
      tutorialDismissed: typeof data.tutorialDismissed === "boolean"
        ? data.tutorialDismissed : completed.includes(ticketIds[0] ?? ""),
      earned,
      completed,
      streak: Number.isInteger(data.streak) && data.streak >= 0 && data.streak <= completed.length ? data.streak : 0,
      run: resume && data.task === task && validMetric(run?.security) && validMetric(run?.stability) &&
        typeof run?.hint === "boolean" && typeof run?.flawless === "boolean"
        ? { security: run.security, stability: run.stability, hint: run.hint, flawless: run.flawless }
        : initialRun,
    }
  } catch {
    return initial
  }
}

export function recordFeedback(current: Feedback, event: FeedbackEvent, task: string, total: number, repaired: boolean): Feedback {
  if (event === "restart") return { ...current, run: initialRun }
  if (event === "hint") return { ...current, run: { ...current.run, hint: true } }
  const change = changes[event]
  if (change) {
    current = { ...current, run: {
      ...current.run,
      security: metric(current.run.security + change.security),
      stability: metric(current.run.stability + change.stability),
      flawless: current.run.flawless && change.security >= 0 && change.stability >= 0,
    } }
  }
  const unlocked: Achievement[] = []
  if (event === "discovery") unlocked.push("skeptical")
  if (event === "clean" && repaired) unlocked.push("precise")
  if (event === "release") {
    if (!current.run.hint) unlocked.push("independent")
    if (!current.completed.includes(task)) {
      const completed = [...current.completed, task]
      const streak = current.run.flawless ? current.streak + 1 : 0
      if (streak >= 2) unlocked.push("streak")
      if (completed.length === total) unlocked.push("shift")
      current = { ...current, completed, streak }
    }
  }
  return { ...current, earned: [...new Set([...current.earned, ...unlocked])] }
}
