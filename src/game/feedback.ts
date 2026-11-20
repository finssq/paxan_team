import type { ReviewStep } from "./review"

export const shiftDeadline = "18:45"

export const questSteps: { label: string; completed: ReviewStep[] }[] = [
  { label: "Запустить проверку", completed: ["locate", "patch", "retest", "stamp", "released"] },
  { label: "Найти уязвимую строку", completed: ["patch", "retest", "stamp", "released"] },
  { label: "Проверить исправление", completed: ["stamp", "released"] },
  { label: "Подтвердить выпуск", completed: ["released"] },
]

export const characters = {
  developer: { name: "Разработчик", hair: "#27273d", skin: "#eab28f", shirt: "#4873af", background: "#2a406a" },
  mentor: { name: "Наставник", hair: "#d1bcca", skin: "#b67964", shirt: "#447e71", background: "#283e40" },
}

export type Mood = "smile" | "alarmed" | "shocked" | "calm" | "guiding" | "approve"
export type Message = { author: keyof typeof characters; mood: Mood; text: string }

export const mentorGreeting: Message = { author: "mentor", mood: "calm", text: "Я на связи, если понадобится помощь." }

export const reactions = {
  discovery: { author: "developer", mood: "alarmed", text: "Ключ в браузере? Хорошо, что заметили до выпуска." },
  security: { author: "developer", mood: "alarmed", text: "В виджете ключа уже нет, но проверка всё ещё его видит." },
  feature: { author: "developer", mood: "shocked", text: "Стоп, оплата перестала работать. Покупатель даже чек не получит." },
  clean: { author: "mentor", mood: "approve", text: "Обе проверки прошли. Теперь можно выпускать обновление." },
  release: { author: "developer", mood: "smile", text: "Выпустили! И оплата работает. Вот теперь можно выдохнуть." },
} satisfies Record<string, Message>

export const achievements = {
  skeptical: { title: "Не верю ИИ", detail: "Обнаружена первая уязвимость за зелёным бейджем ИИ." },
  independent: { title: "Чистая работа", detail: "Задача выпущена без подсказки наставника." },
  precise: { title: "Хирургический фикс", detail: "Уязвимость закрыта, функция по-прежнему работает." },
  streak: { title: "Серия без ошибок", detail: "Две разные задачи подряд выпущены без потерь метрик." },
  shift: { title: "Смена закрыта", detail: "Все задачи главы выпущены." },
}

export type Achievement = keyof typeof achievements
type Metrics = { security: number; stability: number }
type Run = Metrics & { hint: boolean; flawless: boolean }
export type Feedback = {
  sound: boolean
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
const initial: Feedback = { sound: false, earned: [], completed: [], streak: 0, run: initialRun }
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
