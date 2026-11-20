import { Check, ShieldCheck, Zap } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"
import { characters, questSteps } from "./feedback"
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

const dockGlyphs = {
  code: <><rect x="1" y="3" width="20" height="16" rx="4" /><path className="os-icon-cutout" d="m6 8 3 3-3 3" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><rect className="os-icon-accent" x="11" y="13" width="5" height="2" rx="1" /></>,
  browser: <><circle cx="11" cy="11" r="10" /><path className="os-icon-accent" d="m16.8 5.2-4 7.6-7.6 4 4-7.6z" /><path className="os-icon-cutout" d="m5.2 16.8 7.6-4-3.6-3.6z" /></>,
  chat: <><path d="M11 2C5.2 2 1 5.5 1 10.1c0 2.6 1.4 4.8 3.7 6.3L4 20l4.8-2c.7.1 1.4.2 2.2.2 5.8 0 10-3.5 10-8.1S16.8 2 11 2Z" /><g className="os-icon-accent"><circle cx="6.5" cy="10.3" r="1.25" /><circle cx="11" cy="10.3" r="1.25" /><circle cx="15.5" cy="10.3" r="1.25" /></g></>,
  vault: <><path d="M6 9V6a5 5 0 0 1 10 0v3h-2.5V6a2.5 2.5 0 0 0-5 0v3z" /><rect x="3" y="8" width="16" height="13" rx="3.5" /><path className="os-icon-accent" d="M11 11a2.1 2.1 0 0 0-1 4v2h2v-2a2.1 2.1 0 0 0-1-4Z" /></>,
  tickets: <><rect x="3" y="1.5" width="16" height="19" rx="3" /><path className="os-icon-cutout" d="M7 7h8m-8 4h5" fill="none" strokeWidth="1.6" strokeLinecap="round" /><path className="os-icon-accent" d="m12 15.1 1.7 1.6 3.1-3.2" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></>,
}

export function DockIcon({ app }: { app: keyof typeof dockGlyphs }) {
  return <span className="os-dock-tile"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">{dockGlyphs[app]}</svg></span>
}

export function Portrait({ message }: { message: Message }) {
  const { mood, author } = message
  const person = characters[author]
  const reduced = useReducedMotion()
  const startled = mood === "shocked" || mood === "alarmed"
  const happy = mood === "smile" || mood === "approve"
  return (
    <motion.svg className="os-portrait" key={mood} viewBox="0 0 36 36" aria-hidden="true" data-author={author}
      initial={reduced ? false : { opacity: .72, scale: .9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 320, damping: 21 }}>
      <rect width="36" height="36" rx="9" fill="var(--portrait-background)" />
      <path d="M2 36v-2c3-6 9-9 16-9s13 3 16 9v2" fill="var(--portrait-shirt)" />
      <path d="M14 23h8v7c-2 3-6 3-8 0z" fill={person.skin} />
      <rect x="9" y="7" width="18" height="20" rx="8" fill={person.skin} />
      <path d={author === "developer" ? "M8 16V11c0-6 5-8 11-8 5 0 9 3 9 8v5l-3-4c-5 1-9-1-10-3l-4 4z" : "M8 18v-6c0-5 4-9 10-9 6 0 10 3 10 9v6l-3-5c-1-3-5-4-7-4s-5 1-7 4z"} fill="var(--portrait-hair)" />
      <path d={startled ? "m12 15 4-2m4 0 4 2" : mood === "guiding" ? "m12 14 4-1m4 2h4" : "M12 15h4m4 0h4"} stroke="#503a30" strokeWidth="1.25" strokeLinecap="round" fill="none" />
      <circle cx="14" cy="17" r={startled ? 1.25 : .9} fill="#352a24" /><circle cx="22" cy="17" r={startled ? 1.25 : .9} fill="#352a24" />
      {author === "mentor" && <path d="M11 16h6v4h-6zm8 0h6v4h-6zm-2 2h2" fill="none" stroke="#443a2c" strokeWidth=".8" />}
      {mood === "shocked" ? <ellipse cx="18" cy="22" rx="2.3" ry="2" fill="#7e493c" /> :
        <path d={happy ? "M15 21q3 4 6 0" : mood === "alarmed" ? "M15 23q3-3 6 0" : "M16 22h4"} fill="none" stroke="#7e493c" strokeWidth="1.3" strokeLinecap="round" />}
    </motion.svg>
  )
}
