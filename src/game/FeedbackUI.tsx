import { Check } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"
import { questSteps } from "./feedback"
import type { Message } from "./feedback"
import type { ReviewStep } from "./review"

export function Quest({ step }: { step: ReviewStep }) {
  const next = questSteps.find(item => !item.completed.includes(step))
  const reduced = useReducedMotion()
  const quest = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      const panel = quest.current
      if (panel?.open && event.target instanceof Node && !panel.contains(event.target)) panel.open = false
    }
    window.addEventListener("pointerdown", dismiss)
    return () => window.removeEventListener("pointerdown", dismiss)
  }, [])

  return (
    <details className="os-quest" ref={quest} onKeyDown={event => {
      if (event.key !== "Escape" || !event.currentTarget.open) return
      event.stopPropagation()
      event.currentTarget.open = false
      event.currentTarget.querySelector("summary")?.focus()
    }}>
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

const dockIconNames = {
  code: "WorkCode",
  browser: "WorkBrowser",
  chat: "WorkChat",
  vault: ".env Сейф",
  tickets: "Тикеты",
}

export function DockIcon({ app }: { app: keyof typeof dockIconNames }) {
  return <img src={`${import.meta.env.BASE_URL}icons/${app}.png`} alt={dockIconNames[app]} draggable={false}
    className="h-11 w-11 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)] transition-transform" />
}

export function Portrait({ message }: { message: Message }) {
  const { mood, author } = message
  const reduced = useReducedMotion()
  return (
    <motion.img className="os-portrait" key={mood} src={`${import.meta.env.BASE_URL}icons/${author}.svg`} alt="" data-author={author}
      initial={reduced ? false : { opacity: .72, scale: .9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 320, damping: 21 }} />
  )
}
