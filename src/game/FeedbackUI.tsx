import { Check, LockKeyhole, Trophy } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"
import type { KeyboardEvent } from "react"
import { achievements, questSteps } from "./feedback"
import type { Achievement, Message } from "./feedback"
import type { ReviewStep } from "./review"

function useDismissibleDetails() {
  const details = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      const panel = details.current
      if (panel?.open && event.target instanceof Node && !panel.contains(event.target)) panel.open = false
    }
    window.addEventListener("pointerdown", dismiss)
    return () => window.removeEventListener("pointerdown", dismiss)
  }, [])
  return details
}

function closeDetailsOnEscape(event: KeyboardEvent<HTMLDetailsElement>) {
  if (event.key !== "Escape" || !event.currentTarget.open) return
  event.stopPropagation()
  event.currentTarget.open = false
  event.currentTarget.querySelector("summary")?.focus()
}

export function Quest({ step }: { step: ReviewStep }) {
  const next = questSteps.find(item => !item.completed.includes(step))
  const reduced = useReducedMotion()
  const quest = useDismissibleDetails()
  return (
    <details className="os-quest" ref={quest} onKeyDown={closeDetailsOnEscape}>
      <summary><strong>Цель</strong><span>{next?.label ?? "Задача завершена"}</span></summary>
      <ol className="os-quest-panel">
        {questSteps.map(item => {
          const done = item.completed.includes(step)
          return <li key={item.label} data-done={done} aria-current={item === next ? "step" : undefined}>
            <span className="os-quest-tick">{done && <motion.span initial={reduced ? false : { scale: .4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 360, damping: 20 }}><Check size={13} aria-hidden="true" /></motion.span>}</span>
            {item.label}
          </li>
        })}
      </ol>
    </details>
  )
}

const tutorialText = {
  1: "Сначала проверь фичу Дениса — вдруг там дыра",
  2: "Ключ утёк в браузер. Нажми на строки, чтобы расшифровать код, и отметь опасную",
  3: "Спрячь секретный ключ на сервер",
  4: "Перепроверь, что атака отбита, и выпускай в продакшн",
}

export type TutorialStep = keyof typeof tutorialText

export function TutorialHint({ step, onSkip, atDock = false }: { step: TutorialStep; onSkip: () => void; atDock?: boolean }) {
  return (
    <aside className={`os-tutorial-hint${atDock ? " os-tutorial-dock" : ""}`}>
      <div className="os-tutorial-hint-heading">
        <strong>Макс</strong>
        <button type="button" className="os-tutorial-skip" onClick={onSkip}>Пропустить</button>
      </div>
      <p id="workos-tutorial-hint" aria-live="polite"><strong>Шаг {step}/4</strong> · {tutorialText[step]}</p>
    </aside>
  )
}

export function QuickHelp({ onRepeat, canRepeat }: { onRepeat: () => void; canRepeat: boolean }) {
  const help = useDismissibleDetails()

  return (
    <details className="os-quick-help" ref={help} onKeyDown={closeDetailsOnEscape}>
      <summary aria-label="Шпаргалка">?</summary>
      <section className="os-help-panel" aria-label="Шпаргалка WorkOS">
        <ul role="list">
          <li><strong>WorkCode</strong> — смотри код, читай расшифровку строк и отмечай уязвимость.</li>
          <li><strong>WorkBrowser</strong> — проверяй, работает ли фича и проходит ли атака хакера.</li>
          <li><strong>WorkChat</strong> — следи за коллегами и проси подсказку у Макса.</li>
        </ul>
        <button type="button" className="os-secondary" disabled={!canRepeat} onClick={() => {
          if (help.current) {
            help.current.open = false
            help.current.querySelector("summary")?.focus()
          }
          onRepeat()
        }}>Повторить обучение</button>
      </section>
    </details>
  )
}

export function AchievementList({ earned }: { earned: readonly Achievement[] }) {
  const unlocked = new Set<string>(earned)
  const entries = Object.entries(achievements)

  return (
    <>
      <p className="os-achievement-count">Открыто {earned.length} из {entries.length}</p>
      <ul className="os-achievement-list" role="list">
        {entries.map(([id, achievement]) => {
          const isEarned = unlocked.has(id)
          const Icon = isEarned ? Trophy : LockKeyhole
          return (
            <li key={id} data-earned={isEarned}>
              <span className="os-achievement-icon"><Icon size={16} aria-hidden="true" /></span>
              <div>
                <strong>{achievement.title}</strong>
                <span className="sr-only">. {isEarned ? "Открыта" : "Закрыта"}.</span>
                <p>{achievement.detail}</p>
              </div>
              {isEarned && <Check className="os-achievement-check" size={15} aria-hidden="true" />}
            </li>
          )
        })}
      </ul>
    </>
  )
}

const dockIconNames = {
  code: "WorkCode",
  browser: "WorkBrowser",
  chat: "WorkChat",
  vault: ".env Сейф",
  tickets: "Задачи",
  achievements: "Достижения",
}

export function DockIcon({ app }: { app: keyof typeof dockIconNames }) {
  return (
    <>
      <img src={`${import.meta.env.BASE_URL}icons/${app}.png`} alt={dockIconNames[app]} draggable={false}
        className="h-11 w-11 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)] transition-transform" />
      <span className="os-dock-tooltip" aria-hidden="true">{dockIconNames[app]}</span>
    </>
  )
}

export function Portrait({ message }: { message: Message }) {
  const { mood, author } = message
  const reduced = useReducedMotion()
  return (
    <motion.img className="os-portrait" key={mood} src={`${import.meta.env.BASE_URL}icons/${author}.svg`} alt="" data-author={author}
      initial={reduced ? false : { opacity: .72, scale: .9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 320, damping: 21 }} />
  )
}
