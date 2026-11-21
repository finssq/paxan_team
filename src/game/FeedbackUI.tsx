import { ArrowRight, Check, CircleCheck, Info, LockKeyhole, Trophy } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"
import type { KeyboardEvent, ReactNode } from "react"
import { achievements, characters, questSteps } from "./feedback"
import type { Achievement, Message } from "./feedback"
import type { ReviewStep } from "./review"
import { trainingHints, trainingTeam } from "../data/training"
import { friday, fridayChapter } from "../data/friday"

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

export type TutorialStep = keyof typeof trainingHints

export function HighlightedText({ text }: { text: string }) {
  return text.split(/\*\*([^*]+)\*\*/).map((part, index) => index % 2 === 0 ? part : <strong className="os-keyword" key={index}>{part}</strong>)
}

export function SkipTutorialButton({ onSkip }: { onSkip: () => void }) {
  return <button type="button" className="os-secondary os-tutorial-skip" onClick={onSkip}>Пропустить обучение</button>
}

export function TutorialHint({ step, atDock = false }: { step: TutorialStep; atDock?: boolean }) {
  return (
    <aside className={`os-tutorial-hint${atDock ? " os-tutorial-dock" : ""}`}>
      <strong className="os-tutorial-hint-heading">Макс</strong>
      <p id="workos-tutorial-hint" aria-live="polite"><strong>Шаг {step}/5</strong> · <HighlightedText text={trainingHints[step]} /></p>
    </aside>
  )
}

function TrainingDialog({ titleId, delay = 0, className = "", onDismiss, children }: {
  titleId: string; delay?: number; className?: string; onDismiss?: () => void; children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (dialog.current && !dialog.current.open) dialog.current.showModal()
    }, reducedMotion ? 0 : delay)
    return () => window.clearTimeout(timeout)
  }, [delay, reducedMotion])

  return <dialog className={`os-training-dialog ${className}`} ref={dialog} aria-labelledby={titleId} onCancel={onDismiss}>{children}</dialog>
}

export function TrainingTeamCards() {
  return (
      <ul className="os-team-list" role="list">
        {trainingTeam.map(member => (
          <li key={member.author}>
            <Portrait message={member} />
            <div>
              <strong>{characters[member.author].name}</strong>
              <span>{member.role}</span>
              <p>{member.description}</p>
            </div>
          </li>
        ))}
      </ul>
  )
}

export function TrainingTeam({ onContinue }: { onContinue: () => void }) {
  return (
    <TrainingDialog titleId="os-training-team-title" className="os-training-team" onDismiss={onContinue}>
      <h2 id="os-training-team-title">Познакомься с твоей командой</h2>
      <TrainingTeamCards />
      <p className="os-team-intro"><HighlightedText text="Ты **стажёр по безопасности**. Проверь обновление Дениса перед выпуском." /></p>
      <button type="button" className="os-primary os-training-action" onClick={onContinue}>Открыть чат <ArrowRight size={20} aria-hidden="true" /></button>
    </TrainingDialog>
  )
}

export function TrainingComplete({ onStart }: { onStart: () => void }) {
  return (
    <TrainingDialog titleId="os-training-complete-title" delay={320}>
      <CircleCheck size={40} aria-hidden="true" />
      <h2 id="os-training-complete-title">Вы прошли обучение</h2>
      <button type="button" className="os-primary os-training-action" onClick={onStart}>Начать смену <ArrowRight size={20} aria-hidden="true" /></button>
    </TrainingDialog>
  )
}

export function QuickHelp({ onToggle }: { onToggle?: (open: boolean) => void }) {
  const help = useDismissibleDetails()

  return (
    <details className="os-quick-help" ref={help} onKeyDown={closeDetailsOnEscape} onToggle={event => onToggle?.(event.currentTarget.open)}>
      <summary aria-label="Шпаргалка"><Info size={24} aria-hidden="true" /></summary>
      <section className="os-help-panel" aria-label={`Справка · ${fridayChapter.title}`}>
        <ul role="list">
          <li><strong>WorkCode</strong> — смотри код, читай расшифровку строк и отмечай уязвимость.</li>
          <li><strong>«Перевод»</strong> объясняет код на русском, <strong>«Код»</strong> показывает исходник.</li>
          <li><strong>WorkBrowser</strong> — проверяй, работает ли фича и проходит ли атака хакера.</li>
          <li><strong>WorkChat</strong> — следи за коллегами и проси подсказку у Макса.</li>
        </ul>
        <h3>Способности</h3>
        <ul role="list">
          {Object.values(friday.abilities).map(ability => <li key={ability.label}><strong>{ability.label}</strong> — {ability.hint}</li>)}
        </ul>
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

export function Portrait({ message }: { message: Pick<Message, "author" | "mood"> }) {
  const { mood, author } = message
  const reduced = useReducedMotion()
  return (
    <motion.img className="os-portrait" key={mood} src={`${import.meta.env.BASE_URL}icons/${author}.svg`} alt="" data-author={author}
      initial={reduced ? false : { opacity: .72, scale: .9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 320, damping: 21 }} />
  )
}
