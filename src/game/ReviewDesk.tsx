import { ArrowRight, Check, CircleAlert, CircleCheck, Clock3, Code2, FlaskConical, KeyRound, Languages, Lightbulb, LockKeyhole, MessageSquare, Minus, RotateCcw, ScanSearch, Server, ShieldCheck, Snowflake, Square, Stamp, Trophy, Volume2, VolumeX, WalletCards, X } from "lucide-react"
import { animate, AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react"
import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react"
import type { createSfx } from "../audio/sfx"
import { trainingChat, trainingKey, trainingLeakExplanation } from "../data/training"
import { friday, fridayChapter, getWaveScenario, practiceTicket, practiceTips } from "../data/friday"
import { releaseEpilogue, storyCopy, storyForWave } from "../data/story"
import type { Packet } from "../data/friday"
import type { Chapter, CheckResult, Ticket } from "../types/game"
import { CodeSource } from "../ui"
import { shuffleArray } from "../shuffleArray"
import { initialReview, review, saveShift } from "./review"
import type { readShift, ReviewAction, ReviewState, ReviewStep } from "./review"
import { achievements, characters, mentorGreeting, reactions, readFeedback, readSoundPreference, recordFeedback, saveSoundPreference } from "./feedback"
import type { Feedback, FeedbackEvent, Message } from "./feedback"
import { AchievementList, DockIcon, HighlightedText, Portrait, Quest, QuickHelp, SkipTutorialButton, TrainingComplete, TrainingTeam, TutorialHint } from "./FeedbackUI"
import type { TutorialStep } from "./FeedbackUI"
import { AllowedHosts, FridayBrief, FridayHud, PracticeDialog } from "./FridayUI"
import type { WavePhase } from "./FridayUI"
import { initialWave } from "./incidentWave"
import { TrafficIntercept } from "./TrafficIntercept"
import "./review.css"

const apps = [
  { id: "code", name: "WorkCode", label: "Код", icon: Code2 },
  { id: "browser", name: "WorkBrowser", label: "Браузер", icon: FlaskConical },
  { id: "chat", name: "WorkChat", label: "Чат", icon: MessageSquare },
] as const

type CodeView = "plain" | "code"
const codeViewKey = "worklab.code-view.v1"

function loadCodeView(): CodeView {
  try { return window.localStorage.getItem(codeViewKey) === "code" ? "code" : "plain" } catch { return "plain" }
}

const patchToken = /https?:\/\/[\w.-]*[\w-](?::\d+)?(?:\/[\w%~@+.-]*[\w%~@+-])*|(?:\/[\w%~@+.-]*[\w%~@+-])+|(?<![\w.-])(?:process\.env(?:\.[\w$]+)*|\.env|secretKey|[\w-]+(?:\.[\w-]+)*\.(?:demo|ts))(?![\w-])/gi

function PatchDetail({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let cursor = 0
  for (const { 0: token, index } of text.matchAll(patchToken)) {
    parts.push(text.slice(cursor, index), <code key={index}>{token}</code>)
    cursor = index + token.length
  }
  return <span className="os-patch-detail">{parts}{text.slice(cursor)}</span>
}

type DeskApp = typeof apps[number]["id"]
type DockPanel = "vault" | "achievements"
type Notice = { id: number; title: string; detail: string; tone: "info" | "warn" | "success" | "achievement" }
type ChatMessage = Message & { sentAt: Date }
type StoryChatMessage = ChatMessage | { author: "player"; text: string; sentAt: Date }
type IncomingMessage = Message & { announce?: boolean }
type TutorialTarget = "browser" | "code" | "code-footer" | "vault" | "vault-trigger" | "dock-code" | "dock-browser"

const spring = { type: "spring", stiffness: 360, damping: 31 } as const
const clockFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
const compactLayout = "(width < 841px), (height < 501px) and (width < 1025px)"
const tutorialSteps: Record<ReviewStep, TutorialStep | null> = { explore: 1, locate: 2, patch: 3, retest: 4, stamp: 5, released: null }
const orderTransitMs = 620
const resizeEdges = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const
type WindowEdge = typeof resizeEdges[number]
type WindowFrame = { x: number; y: number; width: number; height: number }

function openingMessages(ticket: Ticket, includeHint = false): IncomingMessage[] {
  const messages: IncomingMessage[] = [
    { author: "developer", mood: "smile", text: ticket.developer, announce: true },
    mentorGreeting,
  ]
  if (includeHint) messages.push({ author: "mentor", mood: "guiding", text: ticket.hint })
  return messages
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

function AppWindow({ app, layer, active, hidden, maximized, focus, hide, maximize, restore, onSkip, shake = 0, children }: {
  app: typeof apps[number]
  layer: number
  active: boolean
  hidden: boolean
  maximized: boolean
  focus: () => void
  hide: () => void
  maximize: () => void
  restore: () => void
  onSkip?: () => void
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
        data-training-skip={Boolean(onSkip) || undefined}
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
        {onSkip && <div className="os-window-training-actions"><SkipTutorialButton onSkip={onSkip} /></div>}
      </header>
      {children}
      {resizeEdges.map(edge => (
        <span key={edge} className="os-resize-handle" data-edge={edge} aria-hidden="true" onPointerDown={event => startGesture(event, edge)} />
      ))}
    </motion.section>
  )
}

export default function ReviewDesk({ chapter, ticket, saved, audio, training, onStartShift, onAdvanceWave, onComplete }: {
  chapter: Chapter; ticket: Ticket; saved: ReturnType<typeof readShift>; audio: ReturnType<typeof createSfx>
  training: boolean; onStartShift: (feedback: Feedback, startImmediately?: boolean) => void
  onAdvanceWave: (ticket: Ticket, feedback: Feedback) => void
  onComplete: () => void
}) {
  const practice = ticket.id === practiceTicket.id
  const scenario = getWaveScenario(ticket.id)
  const packets = scenario?.packets ?? []
  const fridayMission = Boolean(scenario)
  const [lastPracticeTip, setLastPracticeTip] = useState(-1)
  const reducedMotion = useReducedMotion()
  const [state, dispatch] = useReducer((current: ReviewState, action: ReviewAction) => review(ticket, current, action), saved?.state ?? initialReview)
  const [patchOptions, setPatchOptions] = useState(() => shuffleArray(ticket.patches))
  const [active, setActive] = useState<DeskApp>(() => {
    if (training && state.step === "explore") return "chat"
    return state.step === "locate" || state.step === "patch" ? "code" : "browser"
  })
  const [hidden, setHidden] = useState<DeskApp[]>(() => training ? apps.filter(app => app.id !== active).map(app => app.id) : [])
  const [maximized, setMaximized] = useState<DeskApp | null>(null)
  const [stack, setStack] = useState<DeskApp[]>(() => apps.map(app => app.id).filter(id => id !== active).concat(active))
  const [dockPanel, setDockPanel] = useState<DockPanel | null>(null)
  const [compact, setCompact] = useState(() => window.matchMedia(compactLayout).matches)
  const [keyInVault, setKeyInVault] = useState(false)
  const [browserTab, setBrowserTab] = useState<"preview" | "checks">(() => state.checks ? "checks" : "preview")
  const [paymentTried, setPaymentTried] = useState(false)
  const [wavePaused, setWavePaused] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [sendingOrder, setSendingOrder] = useState(false)
  const sendTimer = useRef<number | undefined>(undefined)
  const [selectedLine, setSelectedLine] = useState(() => state.evidenceId ?? null)
  const [hoveredLine, setHoveredLine] = useState<{ id: string; above: boolean } | null>(null)
  const [codeView, setCodeView] = useState(loadCodeView)
  const [unread, setUnread] = useState(false)
  const [feedback, setFeedback] = useState(() => {
    const restored = saved?.feedback ?? readFeedback(null, [], ticket.id, false)
    return { ...restored, sound: readSoundPreference() }
  })
  const feedbackRef = useRef(feedback)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!training) return []
    const completedSteps = (tutorialSteps[state.step] ?? trainingChat.length + 1) - 1
    const sentAt = new Date()
    return trainingChat.slice(0, completedSteps).flat().map(message => ({ ...message, sentAt }))
  })
  const [incoming, setIncoming] = useState(() => training ? [] : openingMessages(ticket, feedback.run.hint))
  const [endingMessages, setEndingMessages] = useState<ChatMessage[]>(() => saved?.state.step === "released"
    ? releaseEpilogue(feedback.hadAutoDeploy).map(line => ({ ...line, sentAt: new Date() })) : [])
  const [shake, setShake] = useState(0)
  const [notices, setNotices] = useState<Notice[]>([])
  const notice = notices[0]
  const mentorAsked = feedback.run.hint
  const sound = feedback.sound
  const noticeId = useRef(0)
  const activeRef = useRef(active)
  const desk = useRef<HTMLElement>(null)
  const editorBody = useRef<HTMLDivElement>(null)
  const browserBody = useRef<HTMLDivElement>(null)
  const patchList = useRef<HTMLFieldSetElement>(null)
  const chatBody = useRef<HTMLDivElement>(null)
  const dock = useRef<HTMLElement>(null)
  const popover = useRef<HTMLElement>(null)
  const panelTrigger = useRef<HTMLButtonElement | null>(null)
  const dockPanelTitle = dockPanel === "vault" ? "Сейф секретов" : "Ачивки"
  const released = state.step === "released"
  const wave = feedback.wave ?? initialWave
  const wavePhase: WavePhase = released ? "won" : !wave.started ? "ready"
    : !practice && !feedback.run.security ? "lost"
      : !wave.remainingMs ? "timeout" : wavePaused ? "paused" : "live"
  const capturedLeak = packets.some(packet => packet.unsafe && wave.captured.includes(packet.id))
  const tipIndex = state.step === "stamp" ? 3 : state.patchId ? 2 : capturedLeak ? 1 : 0
  const practiceTip = practice && wavePhase === "live" && tipIndex > lastPracticeTip ? practiceTips[tipIndex] : undefined
  const waveRunning = fridayMission && wavePhase === "live" && !helpOpen && !practiceTip
  const xraySweeping = fridayMission && wave.xrayMs > friday.xrayMs
  const xrayVisible = fridayMission && !released && wave.xrayMs > 0 && !xraySweeping
  const guide = fridayMission && wavePhase === "live" ? (
    !capturedLeak ? { step: 1, target: "traffic", text: "Запусти проверку и перехвати пакет." }
      : !state.patchId ? { step: 2, target: "code", text: "Отметь улику и выбери исправление." }
        : state.checks && state.step === "retest" ? { step: 3, target: "code", text: "Проверка не прошла. Выбери другой патч." }
          : state.step === "stamp" ? { step: 3, target: "release", text: "Проверки пройдены. Выпусти исправление." }
            : { step: 3, target: "traffic", text: "Повтори отправку и проверь исправление." }
  ) : undefined
  const ticketCount = chapter.tickets.length
  const ticketIndex = chapter.tickets.indexOf(ticket)
  const waveNumber = ticketIndex + 1
  const nextTicket = chapter.tickets[waveNumber]
  const storyEnabled = !training && !practice && chapter === fridayChapter && waveNumber > 0
  const scene = storyForWave(waveNumber)
  const storyRecord = storyEnabled ? feedback.story?.[ticket.id] : undefined
  const finalReport = storyEnabled && released && waveNumber === ticketCount
  const epilogue = releaseEpilogue(feedback.hadAutoDeploy)
  const storyBadge = training || practice ? { label: storyCopy.warmup, tone: "neutral" }
    : finalReport ? { label: storyCopy.protected, tone: "success" }
      : storyEnabled ? { label: scene.badge, tone: scene.tone } : undefined
  const storyVisible = storyEnabled && wavePhase === "live"
  const storyMessages = storyEnabled ? chapter.tickets.flatMap((task, index): StoryChatMessage[] => {
    const entry = feedback.story?.[task.id]
    if (!entry) return []
    const taskScene = storyForWave(index + 1)
    const sentAt = new Date(entry.startedAt)
    const chat: StoryChatMessage[] = [{ ...taskScene.opening, sentAt }]
    for (const text of getWaveScenario(task.id)?.briefing ?? []) {
      chat.push({ author: "mentor", mood: "guiding", text, sentAt })
    }
    if (entry.choice !== undefined && entry.answeredAt) {
      const answer = taskScene.answers[entry.choice]
      chat.push({ author: "player", text: answer.label, sentAt: new Date(entry.answeredAt) })
      if (entry.replyAt) chat.push({ ...answer.reply, sentAt: new Date(entry.replyAt) })
    }
    return chat
  }) : []
  const visibleMessages = storyEnabled
    ? [...messages, ...storyMessages, ...(finalReport ? endingMessages : [])].sort((first, second) => first.sentAt.getTime() - second.sentAt.getTime())
    : messages
  const completed = new Set([...feedback.completed, ...(released ? [ticket.id] : [])])
  const patch = ticket.patches.find(option => option.id === state.patchId)
  const vaultPatch = ticket.patches.find(option => option.id === "server-payment")
  const keyIsolated = Boolean(vaultPatch && patch === vaultPatch)
  const paymentResult = patch?.checks.feature ?? ticket.initialChecks.feature
  const lines = ticket.lines.map(line => patch?.changes.find(change => change.id === line.id) ?? line)
  const activeLine = hoveredLine?.id ?? selectedLine
  const evidenceWrong = state.step === "locate" && Boolean(state.evidenceId)
  const showPatches = !training && (state.step === "patch" || state.step === "retest" || state.step === "stamp")
  const tutorialStep = training ? tutorialSteps[state.step] : null
  const showTrainingIntro = training && state.step === "explore" && !feedback.trainingIntroSeen
  const trainingMessage: IncomingMessage | undefined = training && !showTrainingIntro
    ? trainingChat.slice(0, tutorialStep ?? trainingChat.length).flat()[messages.length] : undefined
  const typing = finalReport ? undefined : trainingMessage ?? incoming[0]
  const tutorialTarget = getTutorialTarget()
  const dockHint = tutorialTarget?.startsWith("dock-") && !dockPanel && !canSeeApp("chat")

  function canSeeApp(app: DeskApp) {
    return !hidden.includes(app) && (!maximized || maximized === app) && (!compact || active === app)
  }

  function getTutorialTarget(): TutorialTarget | null {
    if (!tutorialStep) return null
    const codeVisible = canSeeApp("code")
    const browserVisible = canSeeApp("browser")
    switch (tutorialStep) {
      case 1: return browserVisible ? "browser" : "dock-browser"
      case 2: return codeVisible ? "code" : "dock-code"
      case 3: {
        if (dockPanel === "vault") return "vault"
        return codeVisible ? "vault-trigger" : "dock-code"
      }
      case 4:
      case 5: {
        if (dockPanel === "vault") return null
        if (browserVisible) return "browser"
        return codeVisible ? "code-footer" : "dock-browser"
      }
    }
  }

  function tutorialAttrs(target: TutorialTarget) {
    if (tutorialTarget !== target) return {}
    return {
      "data-tutorial-target": target,
      "aria-describedby": !target.startsWith("dock-") || dockHint ? "workos-tutorial-hint" : undefined,
    }
  }

  function renderTutorial(target: TutorialTarget) {
    return tutorialTarget === target && tutorialStep !== null && <TutorialHint step={tutorialStep} />
  }

  const notify = useCallback((title: string, detail: string, tone: Notice["tone"] = "info", immediate = false) => {
    const item = { id: ++noticeId.current, title, detail, tone }
    setNotices(queue => immediate ? [item, ...queue.filter(previous => previous.title !== title)] : [...queue, item])
  }, [])

  useEffect(() => {
    desk.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const layout = window.matchMedia(compactLayout)
    const syncLayout = () => setCompact(layout.matches)
    syncLayout()
    layout.addEventListener("change", syncLayout)
    return () => layout.removeEventListener("change", syncLayout)
  }, [])

  useEffect(() => {
    saveShift(ticket, state, feedback)
  }, [ticket, state, feedback])

  useEffect(() => {
    if (!storyVisible || storyRecord || feedbackRef.current.story?.[ticket.id]) return
    const current = feedbackRef.current
    const next = { ...current, story: { ...current.story, [ticket.id]: { startedAt: Date.now() } } }
    feedbackRef.current = next
    setFeedback(next)
    if (activeRef.current !== "chat") setUnread(true)
  }, [storyVisible, storyRecord, ticket.id])

  useEffect(() => {
    if (!storyVisible || storyRecord?.choice === undefined || !storyRecord.answeredAt || storyRecord.replyAt) return
    const timeout = window.setTimeout(() => {
      const current = feedbackRef.current
      const entry = current.story?.[ticket.id]
      if (entry !== storyRecord) return
      const next = { ...current, story: { ...current.story, [ticket.id]: { ...entry, replyAt: Date.now() } } }
      feedbackRef.current = next
      setFeedback(next)
      if (current.sound) audio.play("chatPing")
      if (activeRef.current !== "chat") setUnread(true)
    }, Math.max(0, Math.min(storyCopy.replyDelay, storyCopy.replyDelay - (Date.now() - storyRecord.answeredAt))))
    return () => window.clearTimeout(timeout)
  }, [audio, storyVisible, storyRecord, ticket.id])

  useEffect(() => () => window.clearTimeout(sendTimer.current), [])

  useEffect(() => { audio.setEnabled(sound) }, [audio, sound])

  useEffect(() => {
    if (!waveRunning) return
    let lastTick = performance.now()
    const interval = window.setInterval(() => {
      const now = performance.now()
      const elapsed = Math.floor(now - lastTick)
      lastTick += elapsed
      const current = feedbackRef.current
      if (!current.wave?.remainingMs || !practice && !current.run.security) return
      if (practice && !current.wave.freezeMs && !current.wave.xrayMs) return
      const freezeMs = Math.max(0, current.wave.freezeMs - elapsed)
      const xrayMs = Math.max(0, current.wave.xrayMs - elapsed)
      const remainingMs = practice ? current.wave.remainingMs : Math.max(0, current.wave.remainingMs - Math.max(0, elapsed - current.wave.freezeMs))
      const deployed = !remainingMs
      const run = deployed ? { ...current.run, flawless: false, security: Math.max(0, current.run.security - friday.timeoutDamage) } : current.run
      const next = { ...current, hadAutoDeploy: current.hadAutoDeploy || deployed && !practice,
        wave: { ...current.wave, remainingMs: deployed && run.security ? friday.retryMs : remainingMs,
        freezeMs, xrayMs, combo: deployed ? 1 : current.wave.combo }, run }
      feedbackRef.current = next
      setFeedback(next)
      if (deployed) {
        notify("Денис выкатил баг в прод!", "−35% безопасности", "warn")
        if (run.security) {
          setShake(value => value + 1)
          if (current.sound) audio.play("errorAlarm")
        }
      } else if (current.sound && !practice && !current.wave.freezeMs && remainingMs <= 10_000 &&
        Math.ceil(remainingMs / 1000) < Math.ceil(current.wave.remainingMs / 1000)) {
        audio.play("timerTick")
      }
    }, 200)
    return () => window.clearInterval(interval)
  }, [audio, notify, practice, waveRunning])

  useEffect(() => {
    if (!fridayMission || !shake || reducedMotion || !desk.current?.parentElement) return
    const playback = animate(desk.current.parentElement, { x: [0, -5, 5, -3, 3, 0] }, { duration: .32 })
    return () => playback.stop()
  }, [fridayMission, shake, reducedMotion])

  useEffect(() => {
    if (fridayMission && wavePhase === "lost" && feedbackRef.current.sound) audio.play("errorAlarm")
  }, [audio, fridayMission, wavePhase])

  useEffect(() => {
    if (!notice) return
    if (sound && notice.tone === "achievement") audio.play("achievement")
    const timeout = window.setTimeout(() => setNotices(queue => queue.slice(1)), notice.tone === "achievement" ? 3500 : 2300)
    return () => window.clearTimeout(timeout)
  }, [notice, audio, sound])

  useEffect(() => {
    if (!typing || fridayMission && wavePhase === "lost") return
    const timeout = window.setTimeout(() => {
      const { announce, ...line } = typing
      const message = { ...line, sentAt: new Date() }
      setMessages(history => [...history, message])
      if (!training) setIncoming(queue => queue.slice(1))
      if (activeRef.current !== "chat") {
        setUnread(true)
        if (announce) notify(`${characters[message.author].name} · WorkChat`, message.text)
      }
      if (sound) audio.play("chatPing")
    }, Math.min(training ? 1500 : 1150, 500 + typing.text.length * 6))
    return () => window.clearTimeout(timeout)
  }, [typing, audio, notify, sound, training, fridayMission, wavePhase])

  useEffect(() => {
    if (active !== "chat" || !chatBody.current) return
    const scroller = chatBody.current
    scroller.scrollTop = scroller.scrollHeight
  }, [messages, typing, active, storyRecord, endingMessages])

  useEffect(() => {
    if (active === "code" && state.step === "patch") scrollToPatches()
  }, [active, state.step])

  useEffect(() => {
    if (!xrayVisible) return
    editorBody.current?.querySelector("[data-xray]")?.scrollIntoView({ block: "nearest" })
  }, [active, xrayVisible])

  useEffect(() => {
    const scroller = browserBody.current
    if (scroller && window.matchMedia(compactLayout).matches) scroller.scrollTop = 0
  }, [browserTab, released, state.checks])

  useEffect(() => {
    if (!dockPanel) return
    popover.current?.focus({ preventScroll: true })
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !dock.current?.contains(event.target) && !popover.current?.contains(event.target) && !panelTrigger.current?.contains(event.target)) {
        setDockPanel(null)
      }
    }
    window.addEventListener("pointerdown", dismiss)
    return () => window.removeEventListener("pointerdown", dismiss)
  }, [dockPanel])

  function applyFeedback(event: FeedbackEvent) {
    if (training) return
    const previous = feedbackRef.current
    const next = recordFeedback(previous, event, ticket.id, ticketCount, Boolean(state.patchId))
    if (practice) next.run = { ...next.run, security: previous.run.security }
    if (fridayMission && next.wave) {
      if (event === "feature") next.run = { ...next.run, stability: previous.run.stability }
      if (event === "hint" || event === "feature" || event === "security") next.wave = { ...next.wave, combo: 1 }
      if (event === "release") {
        const combo = next.run.flawless && !next.run.hint ? Math.min(3, next.wave.combo + 1) : 1
        if (next.sound && combo > next.wave.combo) audio.play("comboUp")
        next.wave = { ...next.wave, combo, score: next.wave.score + 400 + Math.floor(next.wave.remainingMs / 1000) * 5 + (combo - 1) * 200 }
      }
    }
    feedbackRef.current = next
    setFeedback(next)
    if (event !== "hint" && event !== "restart" && !fridayMission) setIncoming(queue => [...queue, reactions[event]])
    for (const id of next.earned) {
      if (!previous.earned.includes(id)) notify(achievements[id].title, achievements[id].detail, "achievement")
    }
  }

  const focusApp = useCallback((id: DeskApp) => {
    activeRef.current = id
    setActive(id)
    setStack(current => current.at(-1) === id ? current : current.filter(item => item !== id).concat(id))
    if (id === "chat") {
      setUnread(false)
      const current = feedbackRef.current
      if (fridayMission && wavePhase === "live" && current.wave && !current.wave.rosterSeen) {
        const next = { ...current, wave: { ...current.wave, rosterSeen: true } }
        feedbackRef.current = next
        setFeedback(next)
      }
    }
  }, [fridayMission, wavePhase])

  const openApp = useCallback((id: DeskApp) => {
    setDockPanel(null)
    setHidden(current => training ? apps.filter(app => app.id !== id).map(app => app.id) : current.filter(item => item !== id))
    setMaximized(current => current === id ? current : null)
    focusApp(id)
    window.requestAnimationFrame(() => desk.current?.querySelector<HTMLElement>(`#workos-${id}`)?.focus({ preventScroll: true }))
  }, [focusApp, training])

  useEffect(() => {
    const line = epilogue[endingMessages.length]
    if (!finalReport || !line) return
    const timer = window.setTimeout(() => {
      if (!endingMessages.length) openApp("chat")
      const sentAt = new Date()
      setEndingMessages(history => [...history, { ...line, sentAt }])
      if (feedbackRef.current.sound) audio.play("chatPing")
    }, endingMessages.length ? 950 : 650)
    return () => window.clearTimeout(timer)
  }, [audio, endingMessages.length, epilogue, finalReport, openApp])

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
    const scroller = body
    const topInset = Number.parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0
    scroller.scrollTop += list.getBoundingClientRect().top - scroller.getBoundingClientRect().top - topInset
  }

  function openCode() {
    openApp("code")
    window.requestAnimationFrame(scrollToPatches)
  }

  function changeCodeView(view: CodeView) {
    setCodeView(view)
    setHoveredLine(null)
    try { window.localStorage.setItem(codeViewKey, view) } catch {}
  }

  function markEvidence() {
    if (!selectedLine) {
      notify("Сначала выбери подозрительную строку в коде", "", "info", true)
      editorBody.current?.querySelector(".os-code")?.animate(
        [{ boxShadow: "inset 0 0 0 2px #8ee8729c" }, { boxShadow: "inset 0 0 0 2px #8ee87200" }], 850,
      )
      return
    }
    if (fridayMission && (!waveRunning || !capturedLeak)) {
      notify(waveRunning ? "Сначала перехвати пакет с утечкой в WorkBrowser" : "Продолжи волну, чтобы отметить улику", "", "info", true)
      return
    }
    const action = { type: "mark", lineId: selectedLine } as const
    const marked = review(ticket, state, action)
    if (marked === state) {
      notify("Сначала запусти проверку в WorkBrowser", "", "info", true)
      return
    }
    dispatch(action)
    const current = feedbackRef.current
    if (marked.step === "patch") {
      applyFeedback("evidence")
      if (current.sound) audio.play("fixApply")
      if (!training) openCode()
      return
    }
    if (fridayMission) {
      const next = { ...current, wave: current.wave && { ...current.wave, combo: 1 }, run: { ...current.run, flawless: false } }
      feedbackRef.current = next
      setFeedback(next)
    }
    if (current.sound) audio.play("errorAlarm")
    if (!reducedMotion) editorBody.current?.querySelector('.os-line[aria-pressed="true"]')?.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }],
      200,
    )
    notify("Эта строка не объясняет утечку", "Выбери строку, которая объясняет, куда уходят данные.", "warn", true)
  }

  function closeDockPanel() {
    if (dockPanel) panelTrigger.current?.focus()
    setDockPanel(null)
  }

  function runCheck(action: "check" | "retest") {
    const next = review(ticket, state, { type: action })
    if (next === state) return
    dispatch({ type: action })
    setBrowserTab("checks")
    if (training && activeRef.current === "browser") {
      window.requestAnimationFrame(() => browserBody.current?.querySelector<HTMLElement>(".os-packet-result")?.focus())
    }
    if (next.step === "stamp") {
      notify("Обе проверки пройдены", fridayMission ? ticket.summary : "Обновление готово к выпуску.", "success")
      applyFeedback("clean")
      if (sound) audio.play("success")
    } else {
      notify(next.step === "locate" ? "Обнаружена уязвимость" : "Проверка не пройдена",
        next.checks?.security.ok ? next.checks.feature.detail : next.checks?.security.detail ?? "", "warn")
      applyFeedback(action === "check" ? "discovery" : next.checks?.security.ok ? "feature" : "security")
      if (!fridayMission) setShake(value => value + 1)
      if (sound) audio.play("errorAlarm")
    }
  }

  function finishTrafficCheck() {
    if (!waveRunning) return
    if (state.step === "explore") runCheck("check")
    if (state.step === "retest" && !state.checks) runCheck("retest")
  }

  function catchTraffic(packet: Packet) {
    const current = feedbackRef.current
    if (!waveRunning || !current.wave) return
    const first = !current.earned.includes("matrix")
    const tracked = packets.some(item => item.id === packet.id)
    const captured = tracked && !current.wave.captured.includes(packet.id)
      ? [...current.wave.captured, packet.id] : current.wave.captured
    const newPacket = tracked && !current.wave.credited.includes(packet.id)
    const next: Feedback = { ...current, wave: { ...current.wave, captured,
      credited: newPacket ? [...current.wave.credited, packet.id] : current.wave.credited,
      score: current.wave.score + (newPacket ? 100 : 0) }, earned: first ? [...current.earned, "matrix"] : current.earned }
    feedbackRef.current = next
    setFeedback(next)
    if (sound) {
      audio.play("packetCatch")
      if (packet.unsafe && state.step !== "explore" && (state.step !== "retest" || state.checks)) audio.play("errorAlarm")
    }
    if (first) {
      notify(achievements.matrix.title, achievements.matrix.detail, "achievement")
      setIncoming(queue => [...queue, { author: "developer", mood: "smile", text: "Ого, ты поймал пакет прямо в полёте!" }])
    }
    if (packet.unsafe && state.step === "explore") finishTrafficCheck()
  }

  function sendTrainingOrder(action: "check" | "retest") {
    if (sendTimer.current !== undefined) return
    if (sound) audio.play("packetLaunch")
    setSendingOrder(true)
    sendTimer.current = window.setTimeout(() => {
      sendTimer.current = undefined
      setSendingOrder(false)
      runCheck(action)
    }, reducedMotion ? 150 : orderTransitMs)
  }

  function checkKey() {
    openApp("browser")
    setBrowserTab("checks")
    if (training) return
    if (state.step === "explore") runCheck("check")
    if (state.step === "retest" && !state.checks) runCheck("retest")
  }

  function moveKeyToVault() {
    if (!vaultPatch) return
    if (state.step === "explore") {
      checkKey()
    } else if (state.step === "locate") {
      openCode()
    } else {
      choosePatch(vaultPatch.id)
      setBrowserTab("checks")
      openApp("browser")
    }
  }

  function lockVault() {
    if (!keyInVault || state.step !== "patch" || !vaultPatch) return
    setKeyInVault(false)
    choosePatch(vaultPatch.id)
    setBrowserTab("checks")
  }

  function choosePatch(patchId: string) {
    if (fridayMission && !waveRunning) return
    dispatch({ type: "selectPatch", patchId })
    setPaymentTried(false)
    if (sound) audio.play("fixApply")
  }

  function release() {
    if (review(ticket, state, { type: "release" }) === state) return
    dispatch({ type: "release" })
    if (storyEnabled && waveNumber === ticketCount) onComplete()
    notify("Обновление выпущено", ticket.summary, "success")
    applyFeedback("release")
    if (sound) audio.play("waveWin")
  }

  function restart(keepShift = false) {
    setPatchOptions(shuffleArray(ticket.patches))
    dispatch({ type: "restart" })
    setSelectedLine(null)
    setHoveredLine(null)
    applyFeedback("restart")
    if (fridayMission) {
      const current = feedbackRef.current
      const savedWave = current.wave
      const resumed = keepShift && savedWave ? {
        score: savedWave.score, credited: savedWave.credited, xrayCharges: savedWave.xrayCharges, freezeCharges: savedWave.freezeCharges,
      } : {}
      const next = { ...current, wave: { ...initialWave, ...resumed, started: true },
        run: keepShift ? { ...current.run, security: 40 } : current.run,
        story: keepShift ? current.story : undefined,
        earned: keepShift ? current.earned : [], completed: current.completed.filter(id => id !== ticket.id), streak: 0 }
      feedbackRef.current = next
      setFeedback(next)
      setWavePaused(false)
      setHelpOpen(false)
      setShake(0)
    }
    setMessages([])
    setEndingMessages([])
    setIncoming(openingMessages(ticket))
    setNotices([])
    setUnread(false)
    setBrowserTab("preview")
    setPaymentTried(false)
    openApp("browser")
  }

  function advanceWave() {
    if (wavePhase === "won") {
      if (practice || !nextTicket) {
        beginShift()
      } else {
        const current = feedbackRef.current
        onAdvanceWave(nextTicket, {
          ...current,
          wave: { ...initialWave, score: wave.score, combo: wave.combo },
          run: { ...current.run, flawless: true, hint: false },
        })
      }
      return
    }
    if (wavePhase === "paused") {
      setWavePaused(false)
    } else if (wavePhase === "ready") {
      const next = { ...feedbackRef.current, wave: { ...wave, started: true } }
      feedbackRef.current = next
      setFeedback(next)
      openApp("browser")
    } else {
      restart(wavePhase === "lost")
    }
  }

  function useAbility(ability: "xray" | "freeze") {
    const current = feedbackRef.current
    const wave = current.wave
    if (!waveRunning || !wave) return
    if (ability === "xray" && (!wave.xrayCharges || wave.xrayMs || !ticket.evidenceLineId || state.evidenceId === ticket.evidenceLineId)) return
    if (ability === "freeze" && (!wave.freezeCharges || wave.freezeMs)) return
    const next = { ...current, wave: ability === "xray"
      ? { ...wave, xrayCharges: wave.xrayCharges - 1, xrayMs: friday.xrayMs + friday.xraySweepMs }
      : { ...wave, freezeCharges: wave.freezeCharges - 1, freezeMs: friday.freezeMs } }
    feedbackRef.current = next
    setFeedback(next)
    if (current.sound) audio.play(ability === "freeze" ? "freezeCast" : "xrayScan")
  }

  function askMentor() {
    if (feedbackRef.current.run.hint) return
    applyFeedback("hint")
    setIncoming(queue => [...queue, { author: "mentor", mood: "guiding", text: ticket.hint }])
  }

  function answerStory(choice: 0 | 1) {
    const current = feedbackRef.current
    const entry = current.story?.[ticket.id]
    if (!storyVisible || !entry || entry.choice !== undefined) return
    const next = { ...current, story: { ...current.story, [ticket.id]: { ...entry, choice, answeredAt: Date.now() } } }
    feedbackRef.current = next
    setFeedback(next)
  }

  function beginShift() {
    setPatchOptions(shuffleArray(ticket.patches))
    onStartShift({ ...feedbackRef.current, tutorialDismissed: true })
  }

  function skipPractice() {
    const current = feedbackRef.current
    if (current.sound) audio.play("uiClick")
    onStartShift({ ...current, tutorialDismissed: true }, true)
  }

  function openTrainingChat() {
    const next = { ...feedbackRef.current, trainingIntroSeen: true }
    feedbackRef.current = next
    setFeedback(next)
  }

  function toggleSound() {
    const next = { ...feedbackRef.current, sound: !feedbackRef.current.sound }
    saveSoundPreference(next.sound)
    audio.setEnabled(next.sound)
    feedbackRef.current = next
    setFeedback(next)
  }

  function toggleDockPanel(panel: DockPanel, trigger: HTMLButtonElement) {
    panelTrigger.current = trigger
    setDockPanel(current => current === panel ? null : panel)
  }

  function windowProps(app: typeof apps[number]) {
    return {
      app,
      layer: stack.indexOf(app.id) + 1,
      active: active === app.id,
      hidden: hidden.includes(app.id),
      maximized: maximized === app.id,
      onSkip: training && !released ? beginShift : undefined,
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
    explore: { label: training ? "Провести тестовую оплату" : "Запустить проверки", run: () => training ? sendTrainingOrder("check") : runCheck("check") },
    locate: { label: training ? "Открыть WorkCode" : "Открыть код", run: openCode },
    patch: training ? { label: "Открыть сейф", run: () => setDockPanel("vault") } : { label: "Выбрать исправление", run: openCode },
    retest: state.checks
      ? { label: "Выбрать другой патч", run: openCode }
      : { label: training ? "Перепроверить оплату" : "Перепроверить", run: () => training ? sendTrainingOrder("retest") : runCheck("retest") },
    stamp: { label: "В ПРОДАКШН", run: release },
    released: training ? { label: "Начать смену", run: beginShift } : { label: "Пройти задачу заново", run: () => restart() },
  }[state.step]
  const trainingAction = training && (state.step === "explore" || state.step === "retest" || state.step === "stamp")
  const ActionIcon = training && state.step === "explore" ? WalletCards : state.step === "stamp" ? Stamp
    : released ? RotateCcw : state.step === "locate" || state.step === "patch" ? Code2 : ShieldCheck
  const browserInstruction = state.step === "locate"
    ? "В коде отметьте строку, которая объясняет утечку."
    : state.step === "explore" ? "Проверьте безопасность и работу оплаты."
      : state.step === "retest" && state.checks ? "Для выпуска должны пройти обе проверки."
        : state.step === "stamp" ? "Безопасность и работа функции подтверждены." : undefined

  return (
    <MotionConfig reducedMotion="user">
      <div className="workos" data-training={training || undefined} data-friday={fridayMission || undefined}
        data-game-over={fridayMission && wavePhase === "lost" || undefined}
        onClickCapture={event => {
          if (sound && event.target instanceof Element && !event.target.closest("[data-event-sound]") &&
            event.target.closest("button:not(:disabled), summary, a, .os-window-bar")) audio.play("uiClick")
        }}
        onKeyDown={event => { if (event.key === "Escape") { closeDockPanel(); setNotices(queue => queue.slice(1)) } }}>
        <a className="skip-link" href="#desk">К рабочему столу</a>
        <header className="os-menu">
          <a className="os-home" href="#game" aria-label="WorkLab — к выбору миссий" title="Миссии">
            <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M5 1h12l6 6v12a4 4 0 0 1-4 4H7l-6-6V5a4 4 0 0 1 4-4Z" />
              <path d="m6 8 4 4-4 4m7 0h5" fill="none" stroke="var(--os-dark)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg><span>WorkLab</span>
          </a>
          {storyBadge ? <div className="os-quest os-story-stage">
            <strong>{chapter.title}</strong><span data-tone={storyBadge.tone}>{practice ? "Пробная волна" : storyBadge.label}</span>
          </div> : <Quest step={state.step} />}
          <div className="os-menu-tools">
            {!training && !practice && <span className="os-task-progress">
              Волна {waveNumber}/{ticketCount}
              <span className="os-task-dots" aria-hidden="true">
                {chapter.tickets.map(item => <i key={item.id} data-status={completed.has(item.id) ? "done" : item.id === ticket.id ? "current" : undefined} />)}
              </span>
            </span>}
            <button type="button" className="os-sound" data-event-sound aria-label="Звук" aria-pressed={sound}
              title={sound ? "Нажми, чтобы выключить звук" : "Нажми, чтобы включить звук"} onClick={toggleSound}>
              {sound ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}
              <span>{sound ? "Звук" : "Тихо"}</span>
            </button>
            <QuickHelp onToggle={fridayMission ? setHelpOpen : undefined} />
            <DeskClock />
          </div>
        </header>
        {scenario && <FridayHud service={scenario.service} finalReport={finalReport} run={wave} phase={wavePhase} security={feedback.run.security} guide={guide} practice={practice}
          onPause={() => setWavePaused(true)} onSkip={practice ? skipPractice : undefined} />}
        <div className="os-notifications" aria-live="polite">
          <AnimatePresence mode="wait">
            {notice && <motion.aside key={notice.id} className="os-toast" data-tone={notice.tone} initial={reducedMotion ? false : { x: 26 }} animate={{ x: 0 }} exit={{ x: 16 }} transition={reducedMotion ? { duration: 0 } : spring}>
              <span className="os-toast-icon">{notice.tone === "achievement" ? <Trophy size={19} aria-hidden="true" /> : notice.tone === "warn" ? <CircleAlert size={19} aria-hidden="true" /> : notice.tone === "success" ? <CircleCheck size={19} aria-hidden="true" /> : <MessageSquare size={19} aria-hidden="true" />}</span>
              <div>
                {notice.tone === "achievement" && <span className="os-toast-achievement">Ачивка открыта</span>}
                <strong>{notice.title}</strong><p>{notice.detail}</p>
              </div>
              <button type="button" className="os-icon-button" aria-label="Закрыть уведомление" onClick={() => setNotices(queue => queue.slice(1))}><X size={15} aria-hidden="true" /></button>
            </motion.aside>}
          </AnimatePresence>
        </div>
        <main className="os-desktop" id="desk" ref={desk} tabIndex={-1} data-maximized={maximized !== null}>
          <span className="os-desktop-wordmark" aria-hidden="true">WorkLab</span>
          <AppWindow {...windowProps(apps[0])}>
            {xraySweeping && <div className="os-xray-scan" aria-hidden="true" />}
            <div className="os-filebar os-appsec-tools" aria-label="Инструменты редактора">
              <code><Code2 size={14} aria-hidden="true" /> {ticket.file}</code>
              <div className="os-tool-help">
                <div className="os-code-view" data-view={codeView} role="group" aria-label="Вид редактора" aria-describedby="code-view-help">
                  <button type="button" aria-pressed={codeView === "plain"} aria-describedby="code-view-help" onClick={() => changeCodeView("plain")}><Languages size={15} aria-hidden="true" /> Перевод</button>
                  <button type="button" aria-pressed={codeView === "code"} aria-describedby="code-view-help" onClick={() => changeCodeView("code")}><Code2 size={15} aria-hidden="true" /> Код</button>
                </div>
                <span className="os-tool-tooltip" role="tooltip" id="code-view-help">{friday.codeViewHelp}</span>
              </div>
              {fridayMission ? (["xray", "freeze"] as const).map(ability => {
                const xray = ability === "xray"
                const charges = xray ? wave.xrayCharges : wave.freezeCharges
                const running = xray ? wave.xrayMs > 0 : wave.freezeMs > 0
                const unavailable = !waveRunning || !charges || running || xray && (!ticket.evidenceLineId || state.evidenceId === ticket.evidenceLineId)
                const Icon = xray ? ScanSearch : Snowflake
                const { label, hint } = friday.abilities[ability]
                return <div className="os-tool-help" key={ability}>
                  <button type="button" className="os-ability" data-ability={ability} data-running={running && charges > 0 || undefined} data-event-sound disabled={unavailable}
                    aria-label={`${label}. Зарядов: ${charges}`} aria-describedby={`ability-${ability}-help`} onClick={() => useAbility(ability)}>
                    <Icon size={16} aria-hidden="true" /> {label} <span aria-hidden="true">{charges}</span>
                  </button>
                  <span className="os-tool-tooltip" role="tooltip" id={`ability-${ability}-help`}>{hint}</span>
                </div>
              }) : <button type="button" className="os-secondary" {...tutorialAttrs("vault-trigger")} disabled={training && state.step !== "patch"}
                aria-expanded={dockPanel === "vault"} onClick={event => toggleDockPanel("vault", event.currentTarget)}><LockKeyhole size={16} aria-hidden="true" /> Сейф секретов</button>}
            </div>
            <div className="os-window-scroll os-editor-scroll" ref={editorBody}>
              {renderTutorial("code")}
              {renderTutorial("vault-trigger")}
              {fridayMission && state.step === "locate" && (!capturedLeak || !wave.rosterSeen) && <p className="friday-evidence-guide">
                {!capturedLeak ? "Перехвати пакет с утечкой в WorkBrowser, чтобы отметить улику." : "Если сомневаешься, сверь адрес со списком банка в WorkChat."}
              </p>}
              <div className="preview-code os-code" data-view={codeView} {...tutorialAttrs("code")}>
                {lines.map((line, index) => {
                  const hovered = hoveredLine?.id === line.id
                  const marked = state.evidenceId === line.id
                  const xray = xrayVisible && line.id === ticket.evidenceLineId
                  const selected = selectedLine === line.id
                  const changed = patch?.changes.some(change => change.id === line.id)
                  const syntax = /^\s*(?:type\b|[}\])]+(?:\s+as const)?[;,]?\s*$)/.test(line.text)
                  const hintId = `workos-line-${line.id}`
                  return (
                    <div key={line.id} className="os-code-row">
                      <button
                        type="button"
                        className="preview-line os-line"
                        aria-pressed={selected}
                        aria-describedby={codeView === "code" ? hintId : undefined}
                        data-syntax={codeView === "plain" && syntax || undefined}
                        data-active={activeLine === line.id}
                        data-threat={marked && state.step === "patch"}
                        data-marker={marked ? evidenceWrong ? "retry" : "evidence" : changed ? "changed" : undefined}
                        data-xray={xray || undefined}
                        onClick={() => setSelectedLine(line.id)}
                        onPointerEnter={event => {
                          if (codeView !== "code" || event.pointerType === "touch" || !editorBody.current) return
                          const lineBox = event.currentTarget.getBoundingClientRect()
                          const scrollBox = editorBody.current.getBoundingClientRect()
                          const below = scrollBox.bottom - lineBox.bottom
                          const above = lineBox.top - scrollBox.top
                          setHoveredLine({ id: line.id, above: below < 64 && above > below })
                        }}
                        onPointerLeave={() => setHoveredLine(null)}
                      >
                        <span className="preview-line-number">{String(index + 1).padStart(2, "0")}</span>
                        <span className="os-line-content">
                          {codeView === "plain" && <span className="os-line-meaning">{line.hint}</span>}
                          <CodeSource text={line.text} detailed />
                        </span>
                        {xray && <span className="os-xray-marker"><CircleAlert size={13} aria-hidden="true" /> Уязвимость</span>}
                        {marked && <><span className="sr-only">{evidenceWrong ? "Улика не подтверждена" : "Улика отмечена"}</span>{!xray && (evidenceWrong ? <CircleAlert size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />)}</>}
                      </button>
                      {codeView === "code" && <span id={hintId} className="os-line-tooltip" data-visible={hovered || undefined} data-above={hovered && hoveredLine.above}>{line.hint}</span>}
                      {selected && marked && evidenceWrong && <p className="os-evidence-error" role="status">Эта строка не объясняет утечку. Выбери другую.</p>}
                    </div>
                  )
                })}
              </div>
              {showPatches && ticket.patches.length > 0 && (
                <fieldset className="os-patches" ref={patchList}>
                  <legend>{fridayMission ? "Что отключить перед выпуском?" : "Выберите исправление"}</legend>
                  {patchOptions.map((option, index) => {
                    const selected = option.id === state.patchId
                    const result = selected && state.checks
                      ? state.checks.security.ok && state.checks.feature.ok ? "pass" : "fail"
                      : undefined
                    return (
                      <button type="button" className="os-patch" key={option.id} data-event-sound aria-pressed={selected} data-result={result}
                        disabled={fridayMission && !waveRunning} onClick={() => { if (!selected) choosePatch(option.id) }}>
                        <span className="os-patch-index" aria-hidden="true">{index + 1}</span>
                        <strong>{option.title}</strong>
                        <span className="os-patch-action">{result === "pass" ? <><Check size={14} aria-hidden="true" /> Проверено</> :
                          result === "fail" ? <><CircleAlert size={14} aria-hidden="true" /> Не прошло</> :
                            selected ? "Выбрано" : <>Применить <ArrowRight size={13} aria-hidden="true" /></>}</span>
                        <PatchDetail text={option.detail} />
                      </button>
                    )
                  })}
                </fieldset>
              )}
            </div>
            <footer className="os-window-footer os-code-footer">
              {(state.step === "explore" || state.step === "locate") && <button type="button" className="os-primary os-mark-evidence" data-event-sound
                onClick={markEvidence}><Check size={16} aria-hidden="true" /> Отметить улику</button>}
              {renderTutorial("code-footer")}
              {codeView === "code" && <p className="os-explanation"><HighlightedText text="**Наведись** на строку, чтобы узнать, что она делает." /></p>}
              {codeView === "plain" && state.step === "locate" && <p className="os-explanation">Нажми на строку, которую хочешь отметить как улику.</p>}
              {state.step === "patch" && <p role="status">{training ? "Улика подтверждена. Загляни в подсвеченный сейф." : "Улика подтверждена. Выберите исправление."}</p>}
              {(state.step === "retest" || state.step === "stamp") && <button type="button" className="os-secondary" {...tutorialAttrs("code-footer")} onClick={() => { setBrowserTab("checks"); openApp("browser") }}>К проверкам в браузере</button>}
            </footer>
          </AppWindow>

          <AppWindow {...windowProps(apps[1])} shake={fridayMission ? 0 : shake}>
            <div className="os-browser-chrome">
              <div className="os-address"><LockKeyhole size={14} aria-hidden="true" /><code>{scenario ? `Банк · ${scenario.service}` : training ? "https://demo.local/pay" : "https://shop.local/pay"}</code></div>
              {!training && !fridayMission && <button type="button" className="os-icon-button" aria-label="Обновить предпросмотр" title="Обновить предпросмотр" onClick={() => {
                setBrowserTab("preview")
                setPaymentTried(false)
                notify("WorkBrowser", "Предпросмотр обновлён.")
              }}><RotateCcw size={16} aria-hidden="true" /></button>}
            </div>
            {!training && !fridayMission && !released && <div className="os-browser-modes">
              <div className="os-segments" role="group" aria-label="Режим просмотра">
                <button type="button" aria-pressed={browserTab === "preview"} onClick={() => setBrowserTab("preview")}>Предпросмотр</button>
                <button type="button" aria-pressed={browserTab === "checks"} onClick={() => setBrowserTab("checks")}>Проверки</button>
              </div>
              <span>Тестовые данные</span>
            </div>}
            <div className="os-window-scroll os-browser-scroll" key={released ? "release" : fridayMission ? "incident" : browserTab} ref={browserBody}>
              {scenario && (wavePhase === "live" || wavePhase === "paused") && <>
                <TrafficIntercept key={state.patchId ?? "before"} action={scenario.action} packets={(state.patchId && scenario.patchPackets[state.patchId]) || packets}
                  paused={!waveRunning} guided={guide?.target === "traffic"} onLaunch={() => { if (sound) audio.play("packetLaunch") }}
                  onArrive={finishTrafficCheck} onCatch={catchTraffic} onEvidence={openCode} />
                {wave.captured.length > 0 && <details className="friday-packet-log">
                  <summary>Журнал перехватов ({wave.captured.length})</summary>
                  <ul>{packets.filter(packet => wave.captured.includes(packet.id)).map(packet => <li key={packet.id}>{packet.channel} · {packet.route}</li>)}</ul>
                </details>}
              </>}
              {released ? (
                <div className="os-release">
                  <motion.div className="os-release-stamp" initial={reducedMotion ? false : { opacity: .5, scale: 1.1, rotate: -7 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={spring}><Stamp size={18} aria-hidden="true" /> {finalReport ? storyCopy.attackStopped : fridayMission ? "ВОЛНА ЗАКРЫТА" : "В ПРОДАКШН"}</motion.div>
                  <h3>{finalReport ? storyCopy.protected : training ? "Обучение пройдено" : "Обновление выпущено"}</h3><p>{ticket.summary}</p>
                </div>
              ) : browserTab === "preview" && !fridayMission && (
                <div className="os-payment-preview">
                  <div className="os-payment">
                    <div className="os-payment-icon"><WalletCards size={20} aria-hidden="true" /></div>
                    <div><h3>{ticket.preview.title}</h3><p>{ticket.preview.reference}</p></div>
                    <strong>{ticket.preview.amount}</strong>
                  </div>
                  {!training && <div className="os-payment-trial">
                    <motion.button type="button" className="os-secondary" whileHover={{ y: -1 }} transition={spring} onClick={() => setPaymentTried(true)}>Пробная оплата</motion.button>
                    {paymentTried && <p role="status" data-result={checkStatus(paymentResult)}>{paymentResult.detail}</p>}
                  </div>}
                </div>
              )}
              {sendingOrder && <div className="os-order-track" role="status" aria-label="Заказ отправляется на сервер">
                <span><WalletCards size={16} aria-hidden="true" /> Оплата</span>
                <span><Server size={16} aria-hidden="true" /> Сервер</span>
                <motion.span className="os-order-packet" aria-hidden="true" initial={{ left: reducedMotion ? "50%" : "0%" }}
                  animate={{ left: reducedMotion ? "50%" : "100%" }} transition={{ duration: reducedMotion ? 0 : orderTransitMs / 1000, ease: "linear" }}>
                  <WalletCards size={18} />
                </motion.span>
              </div>}
              {training && (state.step === "locate" || state.step === "stamp") && browserTab === "checks" && <section className="os-packet-result" tabIndex={-1} aria-label="Содержимое пакета">
                <strong>Содержимое пакета</strong>
                <p>{ticket.preview.reference} · {ticket.preview.amount}</p>
                {state.step === "locate" ? <p className="os-vault-status"><code>secretKey = {trainingKey}</code> · Секретный ключ виден</p> : <p className="os-vault-status" data-isolated="true">Секретного ключа в пакете нет</p>}
                {state.step === "locate" && <p><HighlightedText text={trainingLeakExplanation} /></p>}
              </section>}
              {keyIsolated && (browserTab === "checks" || released) && <p className="os-vault-status" data-isolated="true" role="status">Ключ изолирован на сервере</p>}
              {(!training || state.checks) && <div className="os-results" aria-live="polite">
                <CheckTile label="Безопасность" result={state.checks?.security} />
                <CheckTile label={scenario?.featureLabel ?? "Работа функции"} result={state.checks?.feature} />
              </div>}
            </div>
            {(!fridayMission || state.step === "stamp") && <footer className="os-window-footer os-browser-footer" data-has-tutorial={tutorialTarget === "browser" || undefined}>
              {renderTutorial("browser")}
              {!training && !fridayMission && browserInstruction && <p>{browserInstruction}</p>}
              <motion.button type="button" className={`os-primary${trainingAction || fridayMission ? " os-training-action" : ""}`} {...tutorialAttrs("browser")} data-event-sound={state.step === "stamp" || undefined} data-next-action={guide?.target === "release" || undefined} disabled={sendingOrder || fridayMission && !waveRunning}
                whileTap={reducedMotion ? undefined : { scale: .96 }} transition={spring} onClick={browserAction.run}><ActionIcon size={17} aria-hidden="true" /> {sendingOrder ? "Отправка заказа…" : browserAction.label}</motion.button>
            </footer>}
          </AppWindow>

          <AppWindow {...windowProps(apps[2])}>
            {scenario && <AllowedHosts hosts={scenario.hosts} />}
            <div className="os-window-scroll os-messages" role="log" aria-label="Сообщения команды" ref={chatBody}>
              {visibleMessages.map((message, index) => (
                <article className="os-message" data-player={message.author === "player" || undefined} key={`${message.sentAt.getTime()}:${message.author}:${index}`}>
                  {message.author !== "player" && <Portrait message={message} />}
                  <div>
                    <div className="os-message-meta">
                      <strong>{message.author === "player" ? storyCopy.player : characters[message.author].name}</strong>
                      {message.author !== "player" && <span className="os-message-role">{characters[message.author].role}</span>}
                      <time dateTime={message.sentAt.toISOString()}>{clockFormat.format(message.sentAt)}</time>
                    </div>
                    <p><HighlightedText text={message.text} /></p>
                  </div>
                </article>
              ))}
              {typing && (
                <p className="os-typing">
                  <span className="os-typing-dots" aria-hidden="true"><i /><i /><i /></span>
                  {characters[typing.author].name} печатает…
                </p>
              )}
            </div>
            {!training && <footer className="os-window-footer os-chat-footer">
              {storyVisible && storyRecord && !storyRecord.replyAt && <div className="os-story-replies" aria-label={storyCopy.replies}>
                <button type="button" className="os-secondary" disabled={storyRecord.choice !== undefined} onClick={() => answerStory(0)}>{scene.answers[0].label}</button>
                <button type="button" className="os-secondary" disabled={storyRecord.choice !== undefined} onClick={() => answerStory(1)}>{scene.answers[1].label}</button>
              </div>}
              <button type="button" className="os-secondary" disabled={mentorAsked} onClick={askMentor}><Lightbulb size={16} aria-hidden="true" /> {mentorAsked ? "Подсказка в чате" : "Спросить Макса"}</button>
            </footer>}
          </AppWindow>
        </main>
        {showTrainingIntro && <TrainingTeam onContinue={openTrainingChat} />}
        {training && released && <TrainingComplete onStart={beginShift} />}
        {scenario && wavePhase !== "live" && (!finalReport || endingMessages.length === epilogue.length) &&
          <FridayBrief key={wavePhase} phase={wavePhase} run={wave} waveNumber={waveNumber} waveCount={ticketCount} practice={practice} scenario={scenario}
          finalReport={finalReport} epilogue={epilogue}
          onAction={advanceWave} onReset={beginShift} onSkip={practice && wavePhase === "ready" ? skipPractice : undefined} />}
        {practiceTip && <PracticeDialog key={tipIndex} {...practiceTip} action="Попробовать" onAction={() => setLastPracticeTip(tipIndex)} onSkip={skipPractice} />}
        {fridayMission && wave.freezeMs > 0 && wavePhase === "live" && <div className="os-frost" aria-hidden="true">
          <span className="os-frost-wave" />
          <Snowflake className="os-frost-crystal" /><Snowflake className="os-frost-crystal" />
          <Snowflake className="os-frost-crystal" /><Snowflake className="os-frost-crystal" />
        </div>}

        <div className="os-dock-area">
          {dockHint && tutorialStep !== null && <TutorialHint step={tutorialStep} atDock />}
          {dockPanel && (
            <section className="os-popover" ref={popover} tabIndex={-1} aria-labelledby="workos-popover-title">
              <header><h2 id="workos-popover-title">{dockPanelTitle}</h2><button type="button" className="os-icon-button" aria-label="Закрыть панель" onClick={closeDockPanel}><X size={17} aria-hidden="true" /></button></header>
              {dockPanel === "vault" ? <div className="os-vault">
                <p>Серверное хранилище секретов (.env): сюда прячут ключи, чтобы их не видели в браузере</p>
                {renderTutorial("vault")}
                {training && (state.step === "patch" || keyIsolated) ? <>
                  {!keyIsolated && <button type="button" className="os-secondary os-training-key" draggable={!keyInVault} disabled={keyInVault}
                    onDragStart={event => { event.dataTransfer.setData("text/plain", trainingKey); event.dataTransfer.effectAllowed = "move" }}
                    onClick={() => setKeyInVault(true)} aria-label="Перенести секретный ключ в сейф"><KeyRound size={17} aria-hidden="true" /> <code>{trainingKey}</code></button>}
                  <div className="os-training-vault" data-locked={keyIsolated} onDragOver={event => event.preventDefault()} onDrop={event => {
                    event.preventDefault()
                    if (!keyIsolated && event.dataTransfer.getData("text/plain") === trainingKey) setKeyInVault(true)
                  }}>
                    <div className="os-vault-lock">
                      <motion.span animate={{ rotate: keyIsolated && !reducedMotion ? 90 : 0 }}><LockKeyhole size={22} aria-hidden="true" /></motion.span>
                      <code>.env</code>
                    </div>
                    {keyIsolated ? <p className="os-vault-status" data-isolated="true" role="status">Замок закрыт. Ключ остался на сервере.</p>
                      : keyInVault ? <button type="button" className="os-primary" onClick={lockVault}>Повернуть замок</button>
                        : <p>Перетащи сюда ключ или нажми на него.</p>}
                  </div>
                  {keyIsolated && <button type="button" className="os-secondary" onClick={() => openApp("browser")}>Открыть WorkBrowser</button>}
                </> : vaultPatch && (keyIsolated ? <>
                  <p className="os-vault-status" data-isolated="true">Ключ изолирован на сервере</p>
                  <code>PAYMENT_KEY = ••••••••</code>
                </> : <>
                  <p className="os-vault-status">{patch?.checks.security.ok ? "Оплата отключена. Ключ ещё не перенесён в сейф." : "Утечка: ключ доступен в браузере"}</p>
                  <button type="button" className="os-secondary" {...tutorialAttrs("vault")} onClick={moveKeyToVault}>Перенести ключ в .env-сейф</button>
                </>)}
                {!training && <button type="button" className="os-secondary" onClick={checkKey}>Открыть проверку ключа</button>}
              </div> : <AchievementList earned={feedback.earned} />}
            </section>
          )}
          <nav className="os-dock" ref={dock} aria-label="Приложения WorkOS">
            {apps.map(app => {
              const isOpen = !hidden.includes(app.id)
              return (
                <motion.button key={app.id} type="button" className="os-dock-item" data-app={app.id} data-open={isOpen}
                  disabled={training && app.id === "code" && state.step === "explore"}
                  {...(app.id === "chat" ? {} : tutorialAttrs(`dock-${app.id}`))}
                  data-next-action={app.id === "code" && guide?.target === "code" && !canSeeApp("code") || undefined}
                  aria-label={app.label} aria-controls={`workos-${app.id}`} aria-pressed={isOpen && active === app.id} onClick={() => openApp(app.id)} whileTap={{ scale: .95 }} transition={spring}>
                  <DockIcon app={app.id} />
                  {app.id === "chat" && unread && <span className="os-unread" aria-label="Новые сообщения">1</span>}
                </motion.button>
              )
            })}
            <span className="os-dock-divider" aria-hidden="true" />
            <motion.button type="button" className="os-dock-item" data-app="achievements" aria-label="Достижения"
              aria-expanded={dockPanel === "achievements"} onClick={event => toggleDockPanel("achievements", event.currentTarget)} whileTap={{ scale: .95 }} transition={spring}>
              <DockIcon app="achievements" />
            </motion.button>
          </nav>
        </div>

      </div>
    </MotionConfig>
  )
}
