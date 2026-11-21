import { Check, CircleAlert, CircleCheck, Clock3, Code2, FlaskConical, Lightbulb, LockKeyhole, MessageSquare, Minus, RotateCcw, ShieldCheck, Square, Stamp, Trophy, WalletCards, X } from "lucide-react"
import { animate, AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react"
import { useEffect, useReducer, useRef, useState } from "react"
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react"
import { createSfx } from "../audio/sfx"
import type { Chapter, CheckResult, Ticket } from "../types/game"
import { CodeSource } from "../ui"
import { initialReview, restoreReview, review, serializeReview } from "./review"
import type { ReviewAction, ReviewState } from "./review"
import { achievements, characters, mentorGreeting, reactions, readFeedback, recordFeedback } from "./feedback"
import type { FeedbackEvent, Message } from "./feedback"
import { DockIcon, Metric, Portrait, Quest } from "./FeedbackUI"
import "./review.css"

const apps = [
  { id: "code", name: "WorkCode", label: "Код", icon: Code2 },
  { id: "browser", name: "WorkBrowser", label: "Браузер", icon: FlaskConical },
  { id: "chat", name: "WorkChat", label: "Чат", icon: MessageSquare },
] as const

type DeskApp = typeof apps[number]["id"]
type DockPanel = "vault" | "tickets"
type Notice = { id: number; title: string; detail: string; tone: "info" | "warn" | "success" | "achievement" }

const saveKey = "worklab.review.v1"
const feedbackKey = "worklab.feedback.v1"
const developerNoticeTitle = `${characters.developer.name} · WorkChat`
const spring = { type: "spring", stiffness: 360, damping: 31 } as const
const clockFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
const compactLayout = "(width < 841px), (height < 501px) and (width < 1025px)"
const resizeEdges = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const
type WindowEdge = typeof resizeEdges[number]
type WindowFrame = { x: number; y: number; width: number; height: number }

function getWindowScroller(body: HTMLElement) {
  return window.matchMedia(compactLayout).matches ? body.parentElement ?? body : body
}

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(value, high))
}

function fitFrame(frame: WindowFrame, width: number, height: number): WindowFrame {
  const nextWidth = Math.min(width, frame.width)
  const nextHeight = Math.min(height, frame.height)
  return { x: clamp(frame.x, 0, width - nextWidth), y: clamp(frame.y, 0, height - nextHeight), width: nextWidth, height: nextHeight }
}

function resizeFrame(frame: WindowFrame, edge: WindowEdge, dx: number, dy: number, width: number, height: number): WindowFrame {
  const minWidth = Math.min(frame.width, 352)
  const minHeight = Math.min(frame.height, 210)
  const right = frame.x + frame.width
  const bottom = frame.y + frame.height
  const x = edge.includes("w") ? clamp(frame.x + dx, 0, right - minWidth) : frame.x
  const y = edge.includes("n") ? clamp(frame.y + dy, 0, bottom - minHeight) : frame.y
  const nextRight = edge.includes("e") ? clamp(right + dx, x + minWidth, width) : right
  const nextBottom = edge.includes("s") ? clamp(bottom + dy, y + minHeight, height) : bottom
  return { x, y, width: nextRight - x, height: nextBottom - y }
}

function loadReview(ticket: Ticket) {
  try {
    return restoreReview(ticket, window.localStorage.getItem(saveKey))
  } catch {
    return initialReview
  }
}

function checkStatus(result: CheckResult | undefined) {
  return !result ? "pending" : result.ok ? "pass" : "fail"
}

function CheckTile({ label, result }: { label: string; result: CheckResult | undefined }) {
  const Icon = result ? (result.ok ? CircleCheck : CircleAlert) : Clock3
  const status = result ? (result.ok ? "Пройдена" : "Не пройдена") : "Не запускалась"
  return (
    <div className="os-check" data-result={checkStatus(result)}>
      <h3>{label}</h3>
      <span><Icon size={15} aria-hidden="true" /> {status}</span>
      {result && <p>{result.detail}</p>}
    </div>
  )
}

function DeskClock() {
  const [time, setTime] = useState(() => clockFormat.format(new Date()))

  useEffect(() => {
    const timer = window.setInterval(() => setTime(clockFormat.format(new Date())), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return <time className="os-clock" dateTime={time}>{time}</time>
}

function AppWindow({ app, layer, active, hidden, maximized, focus, hide, maximize, restore, shake = 0, children }: {
  app: typeof apps[number]
  layer: number
  active: boolean
  hidden: boolean
  maximized: boolean
  focus: () => void
  hide: () => void
  maximize: () => void
  restore: () => void
  shake?: number
  children: ReactNode
}) {
  const Icon = app.icon
  const reducedMotion = useReducedMotion()
  const [frame, setFrame] = useState<WindowFrame | null>(null)
  const [gesture, setGesture] = useState<"move" | WindowEdge | null>(null)
  const dragRef = useRef<{ pointer: number; x: number; y: number; origin: WindowFrame; mode: "move" | WindowEdge } | null>(null)
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!shake || reducedMotion || !panel.current) return
    const playback = animate(panel.current, { x: [0, -4, 4, -3, 2, 0] }, { duration: .26 })
    return () => playback.stop()
  }, [shake, reducedMotion])

  useEffect(() => {
    const desktop = panel.current?.parentElement
    if (!desktop) return
    const observer = new ResizeObserver(() => {
      if (window.matchMedia(compactLayout).matches) return
      const { clientWidth: width, clientHeight: height } = desktop
      setFrame(current => current && fitFrame(current, width, height))
    })
    observer.observe(desktop)
    return () => observer.disconnect()
  }, [])

  function geometry() {
    const element = panel.current
    const desktop = element?.parentElement
    if (!element || !desktop || window.matchMedia(compactLayout).matches) return
    const { clientWidth: width, clientHeight: height } = desktop
    return { width, height, origin: {
      x: element.offsetLeft, y: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight,
    } }
  }

  function updateFrame(origin: WindowFrame, mode: "move" | WindowEdge, dx: number, dy: number) {
    const bounds = geometry()
    if (!bounds) return
    const { width, height } = bounds
    const fitted = fitFrame(origin, width, height)
    const next = mode === "move"
      ? fitFrame({ ...fitted, x: origin.x + dx, y: origin.y + dy }, width, height)
      : resizeFrame(fitted, mode, dx, dy, width, height)
    if (maximized) {
      if (next.width >= fitted.width && next.height >= fitted.height) return
      restore()
    }
    setFrame(next)
  }

  function startGesture(event: ReactPointerEvent<HTMLElement>, mode: "move" | WindowEdge) {
    if (event.button !== 0 || dragRef.current || (maximized && mode === "move")) return
    const bounds = geometry()
    if (!bounds) return
    event.preventDefault()
    dragRef.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, origin: bounds.origin, mode }
    event.currentTarget.setPointerCapture(event.pointerId)
    setGesture(mode)
  }

  return (
    <motion.section
      className={`os-window os-window-${app.id}`}
      id={`workos-${app.id}`}
      aria-labelledby={`workos-title-${app.id}`}
      ref={panel}
      style={{
        "--os-x": frame && `${frame.x}px`, "--os-y": frame && `${frame.y}px`,
        "--os-width": frame && `${frame.width}px`, "--os-height": frame && `${frame.height}px`,
        zIndex: maximized ? 8 : layer,
      } as CSSProperties}
      data-active={active}
      data-maximized={maximized}
      data-positioned={frame !== null}
      data-moving={gesture === "move"}
      hidden={hidden}
      tabIndex={-1}
      initial={reducedMotion ? false : { opacity: .52 }}
      animate={{ opacity: 1 }}
      transition={spring}
      onPointerDown={focus}
      onFocus={focus}
      onPointerMove={event => {
        const drag = dragRef.current
        if (drag?.pointer === event.pointerId) updateFrame(drag.origin, drag.mode, event.clientX - drag.x, event.clientY - drag.y)
      }}
      onLostPointerCapture={() => { dragRef.current = null; setGesture(null) }}
    >
      <header
        className="os-window-bar"
        onPointerDown={event => {
          if (!(event.target instanceof Element && event.target.closest("button"))) startGesture(event, "move")
        }}
      >
        <h2
          id={`workos-title-${app.id}`}
          tabIndex={0}
          title={maximized ? "Alt + Shift и стрелки — размер" : "Alt и стрелки — перемещение, Alt + Shift и стрелки — размер"}
          onKeyDown={event => {
            if (!event.altKey || (maximized && !event.shiftKey)) return
            const movement: Record<string, [number, number]> = {
              ArrowLeft: [-32, 0], ArrowRight: [32, 0], ArrowUp: [0, -32], ArrowDown: [0, 32],
            }
            const delta = movement[event.key]
            if (!delta) return
            const bounds = geometry()
            if (!bounds) return
            event.preventDefault()
            updateFrame(bounds.origin, event.shiftKey ? "se" : "move", delta[0], delta[1])
          }}
        ><Icon size={21} strokeWidth={2.3} aria-hidden="true" /> {app.name}</h2>
        <div className="os-lights">
          <button type="button" className="os-light os-light-minimize" aria-label={`Свернуть ${app.name}`} title="Свернуть окно" onClick={hide}><Minus size={12} aria-hidden="true" /></button>
          <button type="button" className="os-light os-light-expand" aria-label={maximized ? `Восстановить размер ${app.name}` : `Развернуть ${app.name}`} title={maximized ? "Восстановить размер" : "Развернуть окно"} onClick={maximize}><Square size={10} aria-hidden="true" /></button>
          <button type="button" className="os-light os-light-close" aria-label={`Закрыть ${app.name}`} title="Закрыть окно" onClick={hide}><X size={12} aria-hidden="true" /></button>
        </div>
      </header>
      {children}
      {resizeEdges.map(edge => (
        <span key={edge} className="os-resize-handle" data-edge={edge} aria-hidden="true" onPointerDown={event => startGesture(event, edge)} />
      ))}
    </motion.section>
  )
}

export default function ReviewDesk({ chapter, ticket }: { chapter: Chapter; ticket: Ticket }) {
  const reducedMotion = useReducedMotion()
  const [state, dispatch] = useReducer((current: ReviewState, action: ReviewAction) => review(ticket, current, action), ticket, loadReview)
  const [active, setActive] = useState<DeskApp>(() => state.step === "locate" || state.step === "patch" ? "code" : "browser")
  const [hidden, setHidden] = useState<DeskApp[]>([])
  const [maximized, setMaximized] = useState<DeskApp | null>(null)
  const [stack, setStack] = useState<DeskApp[]>(() => apps.map(app => app.id).filter(id => id !== active).concat(active))
  const [dockPanel, setDockPanel] = useState<DockPanel | null>(null)
  const [browserTab, setBrowserTab] = useState<"preview" | "checks">(() => state.checks ? "checks" : "preview")
  const [paymentTried, setPaymentTried] = useState(false)
  const [selectedLine, setSelectedLine] = useState(() => state.evidenceId ?? null)
  const [hoveredLine, setHoveredLine] = useState<string | null>(null)
  const [unread, setUnread] = useState(true)
  const [feedback, setFeedback] = useState(() => {
    const ids = chapter.tickets.map(item => item.id)
    try {
      return readFeedback(window.localStorage.getItem(feedbackKey), ids, ticket.id,
        state.step !== "explore" || !window.localStorage.getItem(saveKey))
    } catch {
      return readFeedback(null, ids, ticket.id, false)
    }
  })
  const feedbackRef = useRef(feedback)
  const [metricChange, setMetricChange] = useState({ security: 0, stability: 0, sequence: 0 })
  const [messages, setMessages] = useState<Message[]>(() => [
    { author: "developer", mood: "smile", text: ticket.developer },
    mentorGreeting,
    ...(feedback.run.hint ? [{ author: "mentor", mood: "guiding", text: ticket.hint } as const] : []),
  ])
  const [incoming, setIncoming] = useState<Message[]>([])
  const [shake, setShake] = useState(0)
  const [notices, setNotices] = useState<Notice[]>([{ id: 0, title: developerNoticeTitle, detail: ticket.developer, tone: "info" }])
  const notice = notices[0]
  const typing = incoming[0]
  const mentorAsked = feedback.run.hint
  const sound = feedback.sound
  const noticeId = useRef(0)
  const [audio] = useState(createSfx)
  const activeRef = useRef(active)
  const desk = useRef<HTMLElement>(null)
  const editorBody = useRef<HTMLDivElement>(null)
  const browserBody = useRef<HTMLDivElement>(null)
  const patchList = useRef<HTMLFieldSetElement>(null)
  const chatBody = useRef<HTMLDivElement>(null)
  const dock = useRef<HTMLElement>(null)
  const popover = useRef<HTMLElement>(null)
  const released = state.step === "released"
  const ticketCount = chapter.tickets.length + chapter.upcoming.length
  const completed = new Set([...feedback.completed, ...(released ? [ticket.id] : [])])
  const patch = ticket.patches.find(option => option.id === state.patchId)
  const paymentResult = patch?.checks.feature ?? ticket.initialChecks.feature
  const lines = ticket.lines.map(line => patch?.changes.find(change => change.id === line.id) ?? line)
  const activeLine = hoveredLine ?? selectedLine
  const explanation = lines.find(line => line.id === activeLine)?.hint
  const evidenceWrong = state.step === "locate" && Boolean(state.evidenceId)
  const showPatches = state.step === "patch" || state.step === "retest" || state.step === "stamp"

  useEffect(() => {
    desk.current?.focus({ preventScroll: true })
    return () => audio.close()
  }, [audio])

  useEffect(() => {
    try {
      window.localStorage.setItem(feedbackKey, JSON.stringify({ ...feedback, version: 1, task: ticket.id }))
    } catch {
      return
    }
  }, [feedback, ticket.id])

  useEffect(() => {
    try {
      if (state.step === "explore") window.localStorage.removeItem(saveKey)
      else window.localStorage.setItem(saveKey, serializeReview(ticket, state))
    } catch {
      return
    }
  }, [ticket, state])

  useEffect(() => {
    if (!notice) return
    if (notice.tone === "achievement" && feedbackRef.current.sound) audio.play("success")
    const timeout = window.setTimeout(() => setNotices(queue => queue.slice(1)), notice.tone === "achievement" ? 3500 : 2300)
    return () => window.clearTimeout(timeout)
  }, [notice, audio])

  useEffect(() => {
    if (!typing) return
    const timeout = window.setTimeout(() => {
      setMessages(history => [...history, typing])
      setIncoming(queue => queue.slice(1))
      if (activeRef.current !== "chat") setUnread(true)
      if (feedbackRef.current.sound) audio.play("message")
    }, 540)
    return () => window.clearTimeout(timeout)
  }, [typing, audio])

  useEffect(() => {
    if (active !== "chat" || !chatBody.current) return
    const scroller = getWindowScroller(chatBody.current)
    scroller.scrollTop = scroller.scrollHeight
  }, [messages, typing, active])

  useEffect(() => {
    if (active === "code" && state.step === "patch") scrollToPatches()
  }, [active, state.step])

  useEffect(() => {
    const scroller = browserBody.current?.parentElement
    if (scroller && window.matchMedia(compactLayout).matches) scroller.scrollTop = 0
  }, [browserTab, released, state.checks])

  useEffect(() => {
    if (!dockPanel) return
    popover.current?.focus({ preventScroll: true })
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !dock.current?.contains(event.target) && !popover.current?.contains(event.target)) {
        setDockPanel(null)
      }
    }
    window.addEventListener("pointerdown", dismiss)
    return () => window.removeEventListener("pointerdown", dismiss)
  }, [dockPanel])

  function notify(title: string, detail: string, tone: Notice["tone"] = "info") {
    const item = { id: ++noticeId.current, title, detail, tone }
    setNotices(queue => [...queue, item])
  }

  function applyFeedback(event: FeedbackEvent) {
    const previous = feedbackRef.current
    const next = recordFeedback(previous, event, ticket.id, ticketCount, Boolean(state.patchId))
    feedbackRef.current = next
    setFeedback(next)
    const security = next.run.security - previous.run.security
    const stability = next.run.stability - previous.run.stability
    if (event === "restart") setMetricChange({ security: 0, stability: 0, sequence: 0 })
    else if (security || stability) setMetricChange(change => ({ security, stability, sequence: change.sequence + 1 }))
    if (event !== "hint" && event !== "restart") setIncoming(queue => [...queue, reactions[event]])
    for (const id of next.earned) {
      if (!previous.earned.includes(id)) notify(achievements[id].title, achievements[id].detail, "achievement")
    }
  }

  function focusApp(id: DeskApp) {
    if (activeRef.current !== id && sound) audio.play("click")
    activeRef.current = id
    setActive(id)
    setStack(current => current.at(-1) === id ? current : current.filter(item => item !== id).concat(id))
    if (id === "chat") setUnread(false)
  }

  function openApp(id: DeskApp) {
    setDockPanel(null)
    setHidden(current => current.filter(item => item !== id))
    setMaximized(current => current === id ? current : null)
    focusApp(id)
    window.requestAnimationFrame(() => desk.current?.querySelector<HTMLElement>(`#workos-${id}`)?.focus({ preventScroll: true }))
  }

  function hideApp(id: DeskApp) {
    setHidden(current => current.includes(id) ? current : [...current, id])
    if (maximized === id) setMaximized(null)
    if (active === id) {
      const next = apps.find(app => app.id !== id && !hidden.includes(app.id))
      if (next) focusApp(next.id)
    }
    dock.current?.querySelector<HTMLButtonElement>(`[data-app="${id}"]`)?.focus()
  }

  function scrollToPatches() {
    const list = patchList.current
    const body = editorBody.current
    if (!list || !body) return
    const scroller = getWindowScroller(body)
    const topInset = Number.parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0
    scroller.scrollTop += list.getBoundingClientRect().top - scroller.getBoundingClientRect().top - topInset
  }

  function openCode() {
    openApp("code")
    window.requestAnimationFrame(scrollToPatches)
  }

  function closeDockPanel() {
    if (dockPanel) dock.current?.querySelector<HTMLButtonElement>(`[data-app="${dockPanel}"]`)?.focus()
    setDockPanel(null)
  }

  function runCheck(action: "check" | "retest") {
    const next = review(ticket, state, { type: action })
    if (next === state) return
    dispatch({ type: action })
    setBrowserTab("checks")
    if (next.step === "stamp") {
      notify("Обе проверки пройдены", "Обновление готово к выпуску.", "success")
      applyFeedback("clean")
      if (sound) audio.play("success")
    } else {
      notify(next.step === "locate" ? "Обнаружена уязвимость" : "Проверка не пройдена",
        next.checks?.security.ok ? next.checks.feature.detail : next.checks?.security.detail ?? "", "warn")
      applyFeedback(action === "check" ? "discovery" : next.checks?.security.ok ? "feature" : "security")
      setShake(value => value + 1)
      if (sound) audio.play("warning")
    }
  }

  function release() {
    if (review(ticket, state, { type: "release" }) === state) return
    dispatch({ type: "release" })
    notify("Обновление выпущено", ticket.summary, "success")
    applyFeedback("release")
    if (sound) audio.play("stamp")
  }

  function restart() {
    dispatch({ type: "restart" })
    setSelectedLine(null)
    setHoveredLine(null)
    applyFeedback("restart")
    setMessages([{ author: "developer", mood: "smile", text: ticket.developer }, mentorGreeting])
    setIncoming([])
    setNotices([])
    setUnread(true)
    setBrowserTab("preview")
    setPaymentTried(false)
    openApp("browser")
    notify(developerNoticeTitle, ticket.developer)
  }

  function askMentor() {
    if (feedbackRef.current.run.hint) return
    applyFeedback("hint")
    setIncoming(queue => [...queue, { author: "mentor", mood: "guiding", text: ticket.hint }])
  }

  function toggleDockPanel(panel: DockPanel) {
    if (sound) audio.play("click")
    setDockPanel(current => current === panel ? null : panel)
  }

  function windowProps(app: typeof apps[number]) {
    return {
      app,
      layer: stack.indexOf(app.id) + 1,
      active: active === app.id,
      hidden: hidden.includes(app.id),
      maximized: maximized === app.id,
      focus: () => focusApp(app.id),
      hide: () => hideApp(app.id),
      restore: () => setMaximized(current => current === app.id ? null : current),
      maximize: () => {
        focusApp(app.id)
        setMaximized(current => current === app.id ? null : app.id)
      },
    }
  }

  const browserAction = {
    explore: { label: "Запустить проверки", run: () => runCheck("check") },
    locate: { label: "Открыть код", run: openCode },
    patch: { label: "Выбрать исправление", run: openCode },
    retest: state.checks
      ? { label: "Выбрать другой патч", run: openCode }
      : { label: "Перепроверить", run: () => runCheck("retest") },
    stamp: { label: "В ПРОДАКШН", run: release },
    released: { label: "Пройти задачу заново", run: restart },
  }[state.step]
  const ActionIcon = state.step === "stamp" ? Stamp : released ? RotateCcw : state.step === "locate" || state.step === "patch" ? Code2 : ShieldCheck
  const browserInstruction = state.step === "locate"
    ? "В коде отметьте строку, которая объясняет утечку."
    : state.step === "explore" ? "Проверьте безопасность и работу оплаты."
      : state.step === "retest" && state.checks ? "Для выпуска должны пройти обе проверки."
        : state.step === "stamp" ? "Безопасность и работа функции подтверждены." : undefined

  return (
    <MotionConfig reducedMotion="user">
      <div className="workos"
        onPointerDownCapture={() => { if (sound) audio.unlock() }}
        onKeyDownCapture={() => { if (sound) audio.unlock() }}
        onKeyDown={event => { if (event.key === "Escape") { closeDockPanel(); setNotices(queue => queue.slice(1)) } }}>
        <a className="skip-link" href="#desk">К рабочему столу</a>
        <header className="os-menu">
          <a className="os-home" href="./" aria-label="WorkLab — главная" title="На главную">
            <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M5 1h12l6 6v12a4 4 0 0 1-4 4H7l-6-6V5a4 4 0 0 1 4-4Z" />
              <path d="m6 8 4 4-4 4m7 0h5" fill="none" stroke="var(--os-dark)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg><span>WorkLab</span>
          </a>
          <Quest step={state.step} />
          <div className="os-indicators">
            <Metric label="Безопасность" kind="security" value={feedback.run.security} change={metricChange.security} sequence={metricChange.sequence} />
            <Metric label="Стабильность" kind="stability" value={feedback.run.stability} change={metricChange.stability} sequence={metricChange.sequence} />
            <DeskClock />
          </div>
        </header>
        <div className="os-notifications" aria-live="polite">
          <AnimatePresence mode="wait">
            {notice && <motion.aside key={notice.id} className="os-toast" data-tone={notice.tone} initial={reducedMotion ? false : { opacity: 0, x: 26 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={reducedMotion ? { duration: 0 } : spring}>
              <span className="os-toast-icon">{notice.tone === "achievement" ? <Trophy size={19} aria-hidden="true" /> : notice.tone === "warn" ? <CircleAlert size={19} aria-hidden="true" /> : notice.tone === "success" ? <CircleCheck size={19} aria-hidden="true" /> : <MessageSquare size={19} aria-hidden="true" />}</span>
              <div><strong>{notice.title}</strong><p>{notice.detail}</p></div>
              <button type="button" className="os-icon-button" aria-label="Закрыть уведомление" onClick={() => setNotices(queue => queue.slice(1))}><X size={15} aria-hidden="true" /></button>
            </motion.aside>}
          </AnimatePresence>
        </div>
        <main className="os-desktop" id="desk" ref={desk} tabIndex={-1} data-maximized={maximized !== null}>
          <span className="os-desktop-wordmark" aria-hidden="true">WorkLab</span>
          <AppWindow {...windowProps(apps[0])}>
            <div className="os-filebar">
              <code><Code2 size={14} aria-hidden="true" /> {ticket.file}</code>
              <span className="os-audit">ИИ: угроз не найдено</span>
            </div>
            <div className="os-window-scroll os-editor-scroll" ref={editorBody}>
              <div className="preview-code os-code">
                {lines.map((line, index) => {
                  const marked = state.evidenceId === line.id
                  const detected = state.step === "locate" && Boolean(state.checks && !state.checks.security.ok) && selectedLine === line.id
                  const changed = patch?.changes.some(change => change.id === line.id)
                  const hintId = `workos-line-${line.id}`
                  return (
                    <div key={line.id}>
                      <button
                        type="button"
                        className="preview-line os-line"
                        aria-pressed={selectedLine === line.id}
                        aria-describedby={hintId}
                        data-active={activeLine === line.id}
                        data-threat={marked && state.step === "patch"}
                        data-marker={marked ? evidenceWrong ? "retry" : "evidence" : changed ? "changed" : detected ? "suspect" : undefined}
                        onFocus={() => setSelectedLine(line.id)}
                        onClick={() => { setSelectedLine(line.id); if (sound) audio.play("click") }}
                        onPointerEnter={event => { if (event.pointerType !== "touch") setHoveredLine(line.id) }}
                        onPointerLeave={() => setHoveredLine(null)}
                      >
                        <span className="preview-line-number">{String(index + 1).padStart(2, "0")}</span>
                        <CodeSource text={line.text} detailed />
                        {marked && <><span className="sr-only">{evidenceWrong ? "Улика не подтверждена" : "Улика отмечена"}</span>{evidenceWrong ? <CircleAlert size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}</>}
                      </button>
                      <span id={hintId} className="sr-only">{line.hint}</span>
                    </div>
                  )
                })}
              </div>
              {showPatches && ticket.patches.length > 0 && (
                <fieldset className="os-patches" ref={patchList}>
                  <legend>Выберите исправление</legend>
                  {ticket.patches.map(option => (
                    <label className="os-patch" key={option.id}>
                      <input type="radio" name="review-patch" checked={option.id === state.patchId} onChange={() => {
                        dispatch({ type: "selectPatch", patchId: option.id })
                        setPaymentTried(false)
                        if (sound) audio.play("patch")
                      }} />
                      <span><strong>{option.title}</strong><small>{option.detail}</small></span>
                    </label>
                  ))}
                </fieldset>
              )}
            </div>
            <footer className="os-window-footer os-code-footer">
              <p className="os-explanation">{explanation ?? "Наведите или нажмите на строку, чтобы прочитать пояснение."}</p>
              {state.step === "locate" && <div className="os-evidence-actions">
                {evidenceWrong && <p className="os-evidence-error" role="status">Эта строка не объясняет утечку. Выберите другую.</p>}
                <motion.button type="button" className="os-primary" whileTap={reducedMotion ? undefined : { scale: .96 }} disabled={!selectedLine} onClick={() => {
                  if (!selectedLine) return
                  dispatch({ type: "mark", lineId: selectedLine })
                  if (selectedLine === ticket.evidenceLineId) openCode()
                }}><Check size={16} aria-hidden="true" /> Отметить улику</motion.button>
              </div>}
              {state.step === "patch" && <p role="status">Улика подтверждена. Выберите исправление.</p>}
              {(state.step === "retest" || state.step === "stamp") && <button type="button" className="os-secondary" onClick={() => { setBrowserTab("checks"); openApp("browser") }}>К проверкам в браузере</button>}
            </footer>
          </AppWindow>

          <AppWindow {...windowProps(apps[1])} shake={shake}>
            <div className="os-browser-chrome">
              <div className="os-address"><LockKeyhole size={14} aria-hidden="true" /><code>https://shop.local/pay</code></div>
              <button type="button" className="os-icon-button" aria-label="Обновить предпросмотр" title="Обновить предпросмотр" onClick={() => {
                setBrowserTab("preview")
                setPaymentTried(false)
                notify("WorkBrowser", "Предпросмотр обновлён.")
              }}><RotateCcw size={16} aria-hidden="true" /></button>
            </div>
            {!released && <div className="os-browser-modes">
              <div className="os-segments" role="group" aria-label="Режим просмотра">
                <button type="button" aria-pressed={browserTab === "preview"} onClick={() => setBrowserTab("preview")}>Предпросмотр</button>
                <button type="button" aria-pressed={browserTab === "checks"} onClick={() => setBrowserTab("checks")}>Проверки</button>
              </div>
              <span>Тестовые данные</span>
            </div>}
            <div className="os-window-scroll os-browser-scroll" key={released ? "release" : browserTab} ref={browserBody}>
              {released ? (
                <div className="os-release">
                  <motion.div className="os-release-stamp" initial={reducedMotion ? false : { opacity: .5, scale: 1.1, rotate: -7 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={spring}><Stamp size={18} aria-hidden="true" /> В ПРОДАКШН</motion.div>
                  <h3>Обновление выпущено</h3><p>{ticket.summary}</p>
                </div>
              ) : browserTab === "preview" && (
                <div className="os-payment-preview">
                  <div className="os-payment">
                    <div className="os-payment-icon"><WalletCards size={20} aria-hidden="true" /></div>
                    <div><h3>{ticket.preview.title}</h3><p>{ticket.preview.reference}</p></div>
                    <strong>{ticket.preview.amount}</strong>
                  </div>
                  <div className="os-payment-trial">
                    <motion.button type="button" className="os-secondary" whileHover={{ y: -1 }} transition={spring} onClick={() => setPaymentTried(true)}>Пробная оплата</motion.button>
                    {paymentTried && <p role="status" data-result={checkStatus(paymentResult)}>{paymentResult.detail}</p>}
                  </div>
                </div>
              )}
              <div className="os-results" aria-live="polite">
                <CheckTile label="Безопасность" result={state.checks?.security} />
                <CheckTile label="Работа функции" result={state.checks?.feature} />
              </div>
            </div>
            <footer className="os-window-footer os-browser-footer">
              {browserInstruction && <p>{browserInstruction}</p>}
              <motion.button type="button" className="os-primary" whileTap={reducedMotion ? undefined : { scale: .96 }} transition={spring} onClick={browserAction.run}><ActionIcon size={17} aria-hidden="true" /> {browserAction.label}</motion.button>
            </footer>
          </AppWindow>

          <AppWindow {...windowProps(apps[2])}>
            <div className="os-window-scroll os-messages" role="log" aria-label="Сообщения команды" ref={chatBody}>
              {messages.map((message, index) => (
                <article className="os-message" key={index}>
                  <Portrait message={message} />
                  <div>
                    <div className="os-message-meta">
                      <strong>{characters[message.author].name}</strong>
                      <span className="os-message-role">{characters[message.author].role}</span>
                      <time dateTime={ticket.time}>{ticket.time}</time>
                    </div>
                    <p>{message.text}</p>
                  </div>
                </article>
              ))}
              {typing && <p className="os-typing"><span aria-hidden="true">•••</span> {characters[typing.author].name} печатает…</p>}
            </div>
            <footer className="os-window-footer os-chat-footer">
              <motion.button type="button" className="os-secondary" whileHover={mentorAsked ? undefined : { y: -1 }} transition={spring} disabled={mentorAsked} onClick={askMentor}><Lightbulb size={16} aria-hidden="true" /> {mentorAsked ? "Подсказка в чате" : "Спросить Макса"}</motion.button>
            </footer>
          </AppWindow>
        </main>

        <div className="os-dock-area">
          {dockPanel && (
            <section className="os-popover" ref={popover} tabIndex={-1} aria-labelledby="workos-popover-title">
              <header><h2 id="workos-popover-title">{dockPanel === "tickets" ? chapter.title : "Сейф секретов"}</h2><button type="button" className="os-icon-button" aria-label="Закрыть панель" onClick={closeDockPanel}><X size={17} aria-hidden="true" /></button></header>
              {dockPanel === "tickets" ? <>
                <p className="os-ticket-progress">Выпущено: {completed.size} из {ticketCount}</p>
                <ol className="os-ticket-list">
                  {chapter.tickets.map(item => <li key={item.id}><button type="button" onClick={() => openApp("browser")}>{item.title}<span>{completed.has(item.id) ? "Выпущена" : "В работе"}</span></button></li>)}
                  {chapter.upcoming.map(title => <li key={title}><span>{title}</span><small>Скоро</small></li>)}
                </ol>
              </> : <div className="os-vault">
                <span className="os-vault-icon"><LockKeyhole size={20} aria-hidden="true" /></span>
                <p>Служебные ключи хранятся на сервере. Песочница проверяет, доступны ли они браузеру.</p>
                <button type="button" className="os-secondary" onClick={() => { setBrowserTab("checks"); openApp("browser") }}>Открыть проверку ключа</button>
              </div>}
            </section>
          )}
          <nav className="os-dock" ref={dock} aria-label="Приложения WorkOS">
            {apps.map(app => {
              const isOpen = !hidden.includes(app.id)
              return (
                <motion.button key={app.id} type="button" className="os-dock-item" data-app={app.id} data-open={isOpen} aria-label={app.label} aria-controls={`workos-${app.id}`} aria-pressed={isOpen && active === app.id} onClick={() => openApp(app.id)} whileTap={{ scale: .95 }} transition={spring}>
                  <DockIcon app={app.id} />
                  {app.id === "chat" && unread && <span className="os-unread" aria-label="Одно непрочитанное сообщение">1</span>}
                </motion.button>
              )
            })}
            <span className="os-dock-divider" aria-hidden="true" />
            <motion.button type="button" className="os-dock-item" data-app="vault" aria-label="Сейф секретов" aria-expanded={dockPanel === "vault"} onClick={() => toggleDockPanel("vault")} whileTap={{ scale: .95 }} transition={spring}><DockIcon app="vault" /></motion.button>
            <motion.button type="button" className="os-dock-item" data-app="tickets" aria-label="Задачи" aria-expanded={dockPanel === "tickets"} onClick={() => toggleDockPanel("tickets")} whileTap={{ scale: .95 }} transition={spring}><DockIcon app="tickets" /></motion.button>
          </nav>
        </div>

      </div>
    </MotionConfig>
  )
}
