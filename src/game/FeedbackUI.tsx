import { Check, ShieldCheck, Zap } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"
import { questSteps } from "./feedback"
import type { Message } from "./feedback"
import type { ReviewStep } from "./review"

export function Metric({ label, value, change, sequence, kind }: {
  label: string; value: number; change: number; sequence: number; kind: "security" | "stability"
}) {
  const Icon = kind === "security" ? ShieldCheck : Zap
  const reduced = useReducedMotion()
  return (
    <div className="os-hp" data-tone={value >= 75 ? "healthy" : value >= 50 ? "warn" : "danger"}>
      <Icon size={14} aria-hidden="true" />
      <div className="os-hp-rail" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <motion.span initial={false} animate={{ width: `${value}%` }} transition={{ duration: reduced ? 0 : .34 }} />
        {sequence > 0 && Boolean(change) && <motion.i key={sequence} initial={{ opacity: .7 }} animate={{ opacity: 0 }} transition={{ duration: .4 }} />}
      </div>
      <span className="os-hp-value">{value}%</span>
      <AnimatePresence>
        {sequence > 0 && Boolean(change) && <motion.span
          key={sequence}
          className="os-hp-delta"
          aria-hidden="true"
          data-loss={change < 0}
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 0, y: reduced ? 0 : 9 }}
          transition={{ duration: 1.3 }}
        >{change > 0 ? "+" : "−"}{Math.abs(change)}</motion.span>}
      </AnimatePresence>
    </div>
  )
}

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
