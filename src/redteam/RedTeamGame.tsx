import { ArrowLeft, ArrowRight, Check, Crosshair, Flame, Home, LockOpen, MessageCircle, RotateCcw, ScanLine, ShieldCheck, Smartphone, TriangleAlert, Volume2, VolumeX, Zap } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent } from "react"
import type { createSfx } from "../audio/sfx"
import { buildCyberProfile } from "../data/cyberProfile"
import { readSoundPreference, saveSoundPreference } from "../game/feedback"
import AgentPhone, { MessagePush, senders, sidePanelQuery, useOfficeMessages } from "./AgentPhone"
import HackPuzzleModal from "./HackPuzzleModal"
import { BrandLogo } from "../components/BrandLogo"
import { PlayerNicknameField } from "../components/PlayerNicknameField"
import { getPlayerNickname, setPlayerNickname } from "../utils/playerProfile"
import { honeytokenAlert } from "../data/redTeamPuzzles"
import { difficulties, difficultyOrder, resultFor } from "./difficulty"
import type { Difficulty, Rank } from "./difficulty"
import { findings, mapSize, pickups } from "./mapData"
import type { Point } from "./mapData"
import { drawNextVariantSet } from "./puzzleVariants"
import type { PuzzleSet } from "./puzzleVariants"
import { createRenderer } from "./render"
import { closeHack, createRun, failHack, finishHack, fireEmp, openHack, stepRun } from "./simulation"
import type { Phase, Run } from "./simulation"
import "./redteam.css"

const movement = new Map([
  ["KeyW", { x: 0, y: -1 }], ["ArrowUp", { x: 0, y: -1 }],
  ["KeyS", { x: 0, y: 1 }], ["ArrowDown", { x: 0, y: 1 }],
  ["KeyA", { x: -1, y: 0 }], ["ArrowLeft", { x: -1, y: 0 }],
  ["KeyD", { x: 1, y: 0 }], ["ArrowRight", { x: 1, y: 0 }],
])
const neutral = { x: 0, y: 0 }
const portraitQuery = "(max-width: 899px) and (orientation: portrait)"
const touchQuery = "(pointer: coarse), (max-width: 619px), (orientation: landscape) and (max-height: 540px)"
const mapInstructions = [
  ["Подойди на WASD к «Гостевому Wi-Fi» и нажми E", "Подойди к «Гостевому Wi-Fi» и нажми «Взломать»"],
  ["Обойди камеры и взломай «Ноутбук» в офисе (E)", "Обойди камеры и нажми «Взломать» у ноутбука"],
  ["Проберись в IT-зону к «Стикеру» и нажми E", "Подойди к «Стикеру» в IT-зоне и нажми «Взломать»"],
  ["Шлюз открыт! Беги в серверную к «Ядру банка»", "Шлюз открыт! Беги в серверную к «Ядру банка»"],
] as const
type MapNotice = { kind: "controls" | "detected" | "unlocked" } | { kind: "success"; count: number }
const mapPopMotion = `
  @keyframes wl-map-guide-pop {
    from { opacity: .55; transform: translateY(4px) scale(.97); }
    65% { opacity: 1; transform: translateY(-2px) scale(1.015); }
    to { transform: translateY(0) scale(1); }
  }
`
const portraitKey = "worklab.redteam.portrait"
const difficultyStyles = {
  intern: { Icon: ShieldCheck, accent: "[--difficulty-accent:#8EE872]", description: "Базовые взломы · Спокойная охрана" },
  agent: { Icon: Crosshair, accent: "[--difficulty-accent:#F59E0B]", description: "Анализ трафика и файлов · Стандарт" },
  ghost: { Icon: Flame, accent: "[--difficulty-accent:#EF4444]", description: "Ловушки СБ и дешифровка · Быстрая охрана" },
} satisfies Record<Difficulty, { Icon: typeof ShieldCheck; accent: string; description: string }>
const rankPresentation = {
  S: { title: "Идеальный призрак", color: "[--rank-color:#F9DF89] [--rank-glow:#8EE872]", surface: "bg-linear-to-br from-[#453517] to-[#213821] text-[#F9DF89]" },
  A: { title: "Оперативник Red Team", color: "[--rank-color:#8EE872] [--rank-glow:#8EE872]", surface: "bg-[#223821] text-[#8EE872]" },
  B: { title: "Перспективный агент", color: "[--rank-color:#F6BD5B] [--rank-glow:#F59E0B]", surface: "bg-[#392B16] text-[#F6BD5B]" },
  C: { title: "Смелый стажёр", color: "[--rank-color:#CFD8D5] [--rank-glow:#EF4444]", surface: "bg-linear-to-br from-[#292F32] to-[#362727] text-[#E4EBE8]" },
} satisfies Record<Rank, { title: string; color: string; surface: string }>
const resultTabs = ["1. Оценка и анализ", "2. Диалог команды"]
const rankParticles = Array.from({ length: 12 }, (_, index) => index)
const reducedMotionQuery = "(prefers-reduced-motion: reduce)"
const scoreFormat = new Intl.NumberFormat("ru-RU")
const medalClass = "rt-rank-medal grid shrink-0 place-items-center rounded-2xl border-2 border-b-4 font-mono leading-none font-black"
const finalDialogue = [
  ["denis", "Ладно, ты победил... Прямо сейчас ставлю блокировку на ноут и выкидываю стикеры. Хотя бы в Ядре всё чисто?"],
  ["max", "Не совсем. Смотри логи Ядра: чужой вход через гостевой Wi-Fi вчера в 23:14. Кто-то уже прощупывал банк до нас."],
  ["max", "Мы закрыли дыры в коде и нашли лазейки в офисе — теперь у нас есть зацепка на „Призрака“. Отличная работа, стажёр!"],
] as const
const missionOverlay = "fixed inset-0 z-40 flex overflow-y-auto overscroll-contain bg-black/75 p-3 backdrop-blur-sm [@media(max-height:430px)]:p-2"
const missionDialog = "m-auto w-full max-w-2xl shrink-0 overflow-hidden rounded-3xl border-2 border-white/[0.10] bg-[#0D120F] text-white shadow-[0_30px_90px_rgba(0,0,0,0.85)]"
const missionPrimary = "inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#8EE872] border-b-4 border-b-[#4BA835] bg-[#8EE872] px-3 py-1.5 text-center text-xs font-extrabold text-[#10200B] transition-colors hover:bg-[#A7F38F] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8EE872] sm:text-sm"
const missionBack = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3 text-center text-xs font-bold text-[#DCE8DF] transition-colors hover:border-white/25 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8EE872]"

function readPortraitPreference() {
  try { return sessionStorage.getItem(portraitKey) === "yes" } catch { return false }
}

function snapshot(run: Run) {
  return {
    phase: run.phase, time: Math.floor(run.time), elapsed: run.time, charges: run.charges, alert: Math.round(run.alert * 100),
    exposed: run.exposed, alerts: run.alerts, count: run.scanned.length, focus: run.focus,
    events: run.events, score: run.score, items: run.collected.length, difficulty: run.difficulty,
  }
}

function MapGuide({ count, notice, touch }: { count: number; notice: MapNotice | null; touch: boolean }) {
  const step = Math.min(count, mapInstructions.length - 1)
  const guide = notice && (notice.kind === "detected"
    ? { Icon: TriangleAlert, color: "border-[#EF4444]/60 text-[#FFD399]", text: touch
      ? "Тебя заметила охрана! Спрячься за стеной или нажми EMP"
      : "Тебя заметила охрана! Спрячься за стеной или жми пробел (EMP)" }
    : notice.kind === "unlocked"
      ? { Icon: LockOpen, color: "border-[#F59E0B]/65 text-[#FDE8A1]", text: "Шлюз в серверную открыт! Доберись до Ядра банка" }
      : { Icon: notice.kind === "success" ? Check : Crosshair, color: "border-[#8EE872]/50 text-[#BAF7A7]", text: notice.kind === "success"
        ? `Взлом выполнен (${notice.count}/3)! Двигайся к следующей отмеченной цели`
        : touch ? "Управление: джойстик — идти · Обходи лучи камер · «Взломать» у цели"
          : "Управление: WASD / стрелки — идти · Обходи красные лучи камер · E — взлом" })
  return (
    <>
      <div className="pointer-events-none absolute inset-x-2 top-3 z-20 flex justify-center" role="status">
        <div key={step} className="flex max-w-full items-center gap-2 rounded-full border border-[#8EE872]/45 bg-[#0B110E]/92 px-3 py-1.5 text-xs leading-snug font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-md motion-safe:animate-[wl-map-guide-pop_.28s_ease-out] sm:px-4 sm:text-sm">
          <span className="size-2 shrink-0 rounded-full bg-[#8EE872] motion-safe:animate-pulse" aria-hidden="true" />
          <span><strong className="whitespace-nowrap text-[#BDF4AD]">Шаг {step + 1}/4</strong> · {mapInstructions[step]![touch ? 1 : 0]}</span>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-2 bottom-3 z-20 flex justify-center" role="status">
        {guide && <div key={notice?.kind === "success" ? notice.count : notice?.kind} className={`flex items-center gap-2 rounded-xl border bg-[#0B110E]/95 px-3 py-1.5 text-xs leading-snug font-bold shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-md motion-safe:animate-[wl-map-guide-pop_.3s_ease-out] sm:text-sm ${guide.color}`}>
          <guide.Icon size={16} className="shrink-0" aria-hidden="true" />
          <span>{guide.text}</span>
        </div>}
      </div>
    </>
  )
}

function formatTime(time: number) {
  return [Math.floor(time / 60), time % 60].map(value => String(value).padStart(2, "0")).join(":")
}

function formatMultiplier(multiplier: number) {
  return multiplier.toLocaleString("en", { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}

function DifficultyPicker({ value, onChange, compact = false }: {
  value: Difficulty; onChange: (value: Difficulty) => void; compact?: boolean
}) {
  const legend = compact ? "Повторить на сложности:" : "Сложность"
  return (
    <fieldset className="min-w-0">
      <legend className={compact ? "sr-only" : "mb-2 text-xs font-bold text-[#CFDCD0]"}>{legend}</legend>
      <div className={compact ? "flex flex-wrap items-center gap-x-2 gap-y-1.5" : undefined}>
        {compact && <span aria-hidden="true" className="text-xs font-semibold text-[#CFDCD0]">{legend}</span>}
        <div className={compact ? "inline-grid grid-cols-3 gap-0.5 rounded-xl border border-white/10 bg-[#151D18] p-0.5" : "grid grid-cols-1 gap-3 sm:grid-cols-3"}>
          {difficultyOrder.map(id => {
            const { Icon, accent, description } = difficultyStyles[id]
            const level = difficulties[id]
            return (
              <label className={`relative min-w-0 cursor-pointer ${accent}`} key={id}>
                <input className="peer sr-only" type="radio" name="redteam-difficulty" value={id} aria-label={level.label}
                  aria-describedby={compact ? undefined : `rt-difficulty-details-${id}`}
                  checked={value === id} onChange={() => onChange(id)} />
                {compact ? (
                  <span className="block rounded-lg border border-transparent px-1.5 py-2 text-center text-[11px] leading-tight font-bold text-[#C0CFC3] hover:bg-white/8 peer-checked:border-(--difficulty-accent)/50 peer-checked:bg-(--difficulty-accent)/14 peer-checked:text-(--difficulty-accent) peer-focus-visible:outline-2 peer-focus-visible:outline-(--difficulty-accent)">
                    {level.label}
                  </span>
                ) : (
                  <span className="grid h-full gap-2 rounded-2xl border-2 border-white/[0.08] border-b-4 border-b-[#070B08] bg-[#151D18] p-3.5 text-left transition-all hover:border-(--difficulty-accent)/45 active:translate-y-px peer-checked:border-(--difficulty-accent)/75 peer-checked:bg-(--difficulty-accent)/12 peer-checked:shadow-[inset_0_-3px_0_#070B084D] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--difficulty-accent) sm:gap-3 [@media(max-height:430px)]:gap-1.5 [@media(max-height:430px)]:py-2">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pr-6 sm:pr-0">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-(--difficulty-accent)/12 text-(--difficulty-accent)">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 sm:w-full [@media(orientation:landscape)_and_(max-height:430px)]:w-auto">
                        <strong className="text-sm leading-tight sm:text-base">{level.label}</strong>
                        {id === "agent" && <span className="rounded-full bg-[#F59E0B]/14 px-1.5 py-0.5 text-[10px] leading-tight font-bold text-[#F6BD5B]">Баланс</span>}
                      </span>
                    </span>
                    <span id={`rt-difficulty-details-${id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-tight text-[#CFDCD0]">
                      <span className="sm:w-full">{description} · {level.charges} EMP</span>
                      <span className="rounded-md bg-black/25 px-1.5 py-1 font-bold">Очки ×{formatMultiplier(level.score)}</span>
                    </span>
                  </span>
                )}
                {!compact && (
                  <span className="pointer-events-none absolute top-3.5 right-3.5 grid size-5 place-items-center rounded-full border border-white/15 text-transparent peer-checked:border-(--difficulty-accent) peer-checked:bg-(--difficulty-accent) peer-checked:text-[#0D120F] [@media(max-height:430px)]:top-2">
                    <Check size={13} strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
              </label>
            )
          })}
        </div>
      </div>
    </fieldset>
  )
}

function FinalDialogue() {
  return (
    <section className="rt-final-chat space-y-2.5 rounded-2xl border border-[#8EE872]/20 bg-[#121915] p-3.5" aria-labelledby="rt-final-dialogue">
      <h3 id="rt-final-dialogue" className="flex items-center gap-2 text-xs font-extrabold text-[#8EE872]"><MessageCircle size={14} aria-hidden="true" /> Связь · Финал операции</h3>
      <ul className="grid gap-2.5" role="list">
        {finalDialogue.map(([sender, message]) => (
          <li className="flex items-start gap-2.5" key={message}>
            <img src={senders[sender].avatar} alt="" width={40} height={40} className={`size-10 shrink-0 rounded-full object-cover ring-2 ${sender === "max" ? "ring-[#8EE872]/35" : "ring-[#F59E0B]/35"}`} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-1.5 text-xs leading-tight">
                <strong className="text-white">{senders[sender].name}</strong>
                <span className="text-[#B5C7B7]">{sender === "max" ? "Senior AppSec" : senders[sender].role}</span>
              </div>
              <p className="mt-0.5 text-xs leading-snug text-[#D7E2D9] sm:text-sm">«{message}»</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function AnimatedScore({ score }: { score: number }) {
  const [shown, setShown] = useState(() => window.matchMedia(reducedMotionQuery).matches ? score : 0)

  useEffect(() => {
    if (window.matchMedia(reducedMotionQuery).matches) return
    const start = performance.now()
    let frame = requestAnimationFrame(update)
    function update(now: number) {
      const progress = Math.min(1, (now - start) / 650)
      setShown(Math.round(score * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(update)
    }
    return () => cancelAnimationFrame(frame)
  }, [score])

  return (
    <div className="font-mono text-3xl leading-none font-extrabold text-[#8EE872] tabular-nums">
      <span className="sr-only">Итоговый счёт {scoreFormat.format(score)}</span>
      <span aria-hidden="true">{scoreFormat.format(shown)}</span>
    </div>
  )
}

function OperationResult({ hud, playerNickname, puzzleErrors, difficulty, onDifficulty, onRestart, hidden }: {
  hud: ReturnType<typeof snapshot>
  playerNickname: string
  puzzleErrors: number
  difficulty: Difficulty
  onDifficulty: (value: Difficulty) => void
  onRestart: () => void
  hidden: boolean
}) {
  const [revealing, setRevealing] = useState(() => !window.matchMedia(reducedMotionQuery).matches)
  const [tab, setTab] = useState(0)
  const skip = useRef<HTMLButtonElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const result = resultFor(hud.difficulty, hud.score, hud.elapsed, hud.alerts)
  const rank = rankPresentation[result.rank]
  const profile = buildCyberProfile({
    rank: result.rank, difficulty: hud.difficulty, elapsed: hud.elapsed, trophies: hud.items, totalTrophies: pickups.length,
    alerts: hud.alerts, puzzleErrors,
  })
  const stats = [
    ["Сложность", difficulties[hud.difficulty].label],
    ["Время", formatTime(hud.time)],
    ["Трофеи", `${hud.items}/${pickups.length}`],
    ["Тревог", hud.alerts],
  ]

  useEffect(() => {
    if (!revealing) return
    const timer = window.setTimeout(() => setRevealing(false), 1100)
    return () => window.clearTimeout(timer)
  }, [revealing])

  useEffect(() => {
    if (!hidden) (revealing ? skip.current : tabs.current[0])?.focus({ preventScroll: true })
  }, [hidden, revealing])

  function selectTab(index: number) {
    setTab(index)
    tabs.current[index]?.focus({ preventScroll: true })
  }

  function navigateTabs(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
    event.preventDefault()
    selectTab(event.key === "Home" ? 0 : event.key === "End" ? resultTabs.length - 1 : 1 - tab)
  }

  if (hidden) return null

  if (revealing) {
    return (
      <section className={`${missionOverlay} ${rank.color} rt-rank-reveal`} role="dialog" aria-modal="true" aria-label={`Получен ранг ${result.rank}`}>
        <button className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#8EE872]"
          type="button" ref={skip} onClick={() => setRevealing(false)} aria-label="Показать результаты">
          <span className="relative grid size-28 place-items-center">
            <span className="rt-rank-halo" aria-hidden="true" />
            {rankParticles.map(index => <span className="rt-rank-particle" key={index} aria-hidden="true" style={{ "--particle": index } as CSSProperties} />)}
            <span className={`${medalClass} ${rank.surface} rt-rank-stamp relative size-28 text-7xl`} aria-hidden="true">{result.rank}</span>
          </span>
          <span className="rt-rank-caption text-lg font-black tracking-wider text-(--rank-color) uppercase">{rank.title}</span>
          <span className="text-xs font-semibold text-white/65">Нажми, чтобы открыть итоги</span>
        </button>
      </section>
    )
  }

  return (
    <div className={missionOverlay}>
      <section className={`${missionDialog} ${rank.color} rt-result-shell p-3.5 sm:p-5`} role="dialog" aria-modal="true" aria-labelledby="rt-result-title">
        <header className="rt-result-heading flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
          <h2 id="rt-result-title" className="text-xl leading-tight font-extrabold sm:text-2xl">Операция завершена</h2>
          <div className="flex max-w-full flex-wrap gap-0.5 rounded-xl border border-white/10 bg-[#151D18] p-0.5" role="tablist" aria-label="Итоги операции" onKeyDown={navigateTabs}>
            {resultTabs.map((label, index) => (
              <button key={label} ref={node => { tabs.current[index] = node }} className="cursor-pointer rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-bold text-[#BBCBBE] hover:bg-white/8 aria-selected:border-[#8EE872]/35 aria-selected:bg-[#8EE872]/12 aria-selected:text-[#8EE872] focus-visible:outline-2 focus-visible:outline-[#8EE872]"
                type="button" role="tab" id={`rt-result-tab-${index}`} aria-selected={tab === index}
                aria-controls={`rt-result-panel-${index}`} tabIndex={tab === index ? 0 : -1} onClick={() => selectTab(index)}>{label}</button>
            ))}
          </div>
        </header>
        <div className="rt-result-panel rt-result-analysis" role="tabpanel" id="rt-result-panel-0" aria-labelledby="rt-result-tab-0" hidden={tab !== 0}>
          <div className="rt-result-metrics grid min-w-0 gap-2.5">
            <div className="rt-result-hero flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-(--rank-color)/18 bg-linear-to-r from-(--rank-glow)/10 to-[#151D18] p-3">
              <div role="img" aria-label={`Ранг ${result.rank}`} className={`${medalClass} ${rank.surface} size-20 text-5xl`}>{result.rank}</div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#B5C7B7]">Ядро банка взломано</p>
                <p className="text-base leading-snug font-extrabold text-(--rank-color)">{rank.title}</p>
              </div>
              <div className="rt-result-score ml-auto text-right">
                <AnimatedScore score={result.score} />
                <p className="mt-1 text-xs font-semibold text-[#B5C7B7]">×{formatMultiplier(result.multiplier)} за сложность</p>
              </div>
            </div>
            <dl className="rt-result-stats grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Статистика операции">
              {stats.map(([label, value]) => (
                <div className="min-w-0 rounded-xl border border-white/[0.08] bg-[#151D18] px-2.5 py-1.5" key={label}>
                  <dt className="text-[11px] font-medium text-white/65">{label}</dt>
                  <dd className="text-sm leading-tight font-bold text-white tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <section className="rt-cyber-profile grid gap-2.5 rounded-2xl border border-[#8EE872]/20 bg-[#121915] p-3.5" aria-labelledby="rt-profile-title">
            <header>
              <h3 id="rt-profile-title" className="wrap-anywhere text-xs font-extrabold text-[#8EE872]">Профиль агента: {playerNickname}</h3>
              <p className="mt-1 text-base leading-tight font-extrabold text-white sm:text-lg">{profile.verdict}</p>
            </header>
            <p className="text-xs leading-snug text-[#D7E2D9] sm:text-sm">{profile.strength} {profile.advice}</p>
            <div className="grid grid-cols-3 gap-2.5">
              {profile.skills.map(({ label, value, tone }) => (
                <div className="min-w-0 rounded-xl border border-white/8 bg-white/[0.035] px-2 py-1.5 sm:px-2.5" key={tone}>
                  <div className="rt-skill-label flex flex-wrap items-baseline justify-between gap-x-1 text-[10px] leading-tight font-bold text-[#E1ECE3] sm:text-xs" aria-hidden="true">
                    <span className="wrap-anywhere">{label}</span><span className="tabular-nums">{value}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/40" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
                    <span className="rt-skill-fill block h-full rounded-full" data-skill={tone} style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="w-fit rounded-lg border border-[#8EE872]/18 bg-[#8EE872]/8 px-2 py-1 text-xs leading-snug text-[#D7E2D9]">
              <strong className="text-[#8EE872]">Твой профиль:</strong> {profile.role}
            </p>
          </section>
          <div className="rt-result-actions flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.08] pt-2.5">
            <button className={missionBack} type="button" onClick={onRestart}>Пройти ещё раз</button>
            <button className={missionPrimary} type="button" onClick={() => selectTab(1)}>Финал сюжета <ArrowRight size={15} aria-hidden="true" /></button>
          </div>
        </div>
        <div className="rt-result-panel" role="tabpanel" id="rt-result-panel-1" aria-labelledby="rt-result-tab-1" hidden={tab !== 1}>
          <FinalDialogue />
          <div className="rt-result-actions flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-2.5">
            <DifficultyPicker value={difficulty} onChange={onDifficulty} compact />
            <div className="flex flex-wrap items-center gap-2">
              <button className={missionPrimary} type="button" onClick={onRestart}>Пройти ещё раз</button>
              <a className={missionBack} href="#game">К выбору игр</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default function RedTeamGame({ audio, difficulty, onDifficulty, onComplete }: {
  audio: ReturnType<typeof createSfx>
  difficulty: Difficulty
  onDifficulty: (difficulty: Difficulty) => void
  onComplete: (result: { score: number; rank: Rank }) => void
}) {
  const run = useRef<Run | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const mapAction = useRef<HTMLButtonElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const keys = useRef(new Set<string>())
  const stick = useRef({ id: -1, vector: neutral })
  const movementInput = useRef<Point>({ ...neutral })
  const phoneActive = useRef(false)
  const rotateActive = useRef(false)
  const rotateButton = useRef<HTMLButtonElement>(null)
  const selectedDifficulty = useRef(difficulty)
  const preparedPuzzles = useRef<PuzzleSet | null>(null)
  const recordedRun = useRef<Run | null>(null)
  const puzzleErrors = useRef(0)
  const [nicknameDraft, setNicknameDraft] = useState(getPlayerNickname)
  const playerNickname = nicknameDraft.trim() || "Агент"
  const nicknameOnCanvas = useRef(playerNickname)
  const [hud, setHud] = useState(() => snapshot(createRun()))
  const [puzzles, setPuzzles] = useState<PuzzleSet | null>(null)
  const [sound, setSound] = useState(readSoundPreference)
  const [knob, setKnob] = useState(neutral)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [seen, setSeen] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [caughtByTrap, setCaughtByTrap] = useState(false)
  const [mapNotice, setMapNotice] = useState<MapNotice | null>(null)
  const [touchMode, setTouchMode] = useState(() => window.matchMedia(touchQuery).matches)
  const [portrait, setPortrait] = useState(() => window.matchMedia(portraitQuery).matches)
  const [portraitSkipped, setPortraitSkipped] = useState(readPortraitPreference)
  const [dismissedPush, setDismissedPush] = useState("")
  const [hidden, setHidden] = useState(() => document.hidden)
  const rotateRequired = portrait && !portraitSkipped
  const { delivered, typing } = useOfficeMessages(hud.events, attempt, audio.play)
  const latest = delivered.at(-1)

  function clearInputs() {
    keys.current.clear()
    stick.current = { id: -1, vector: neutral }
    setKnob(neutral)
  }

  function begin() {
    clearInputs()
    puzzleErrors.current = 0
    setCaughtByTrap(false)
    const next = preparedPuzzles.current ?? drawNextVariantSet(selectedDifficulty.current)
    preparedPuzzles.current = null
    run.current = createRun("playing", next.difficulty)
    setPuzzles(next)
    setMapNotice({ kind: "controls" })
    setSeen(0)
    setAttempt(value => value + 1)
    setHud(snapshot(run.current))
  }

  function startOperation() {
    setPlayerNickname(nicknameDraft)
    nicknameOnCanvas.current = playerNickname
    begin()
  }

  function changeDifficulty(next: Difficulty) {
    if (next === selectedDifficulty.current) return
    selectedDifficulty.current = next
    preparedPuzzles.current = drawNextVariantSet(next)
    onDifficulty(next)
  }

  function enterHack() {
    const current = run.current
    if (!current || phoneActive.current || rotateActive.current) return
    openHack(current)
    if (current.phase === "hacking") {
      clearInputs()
      setHud(snapshot(current))
    }
  }

  function leaveHack() {
    if (!run.current) return
    closeHack(run.current)
    setHud(snapshot(run.current))
  }

  function handleHackFailure(penalty: number, trap?: boolean) {
    if (!run.current) return
    puzzleErrors.current++
    failHack(run.current, penalty, audio.play)
    if (trap && run.current.phase === "caught") setCaughtByTrap(true)
    setHud(snapshot(run.current))
  }

  function handleHackSuccess() {
    const current = run.current
    if (!current) return
    const previousCount = current.scanned.length
    finishHack(current, audio.play)
    const count = current.scanned.length
    if (count > previousCount) setMapNotice(count === findings.length ? { kind: "unlocked" } : { kind: "success", count })
    setHud(snapshot(current))
  }

  useEffect(() => {
    if (!mapNotice) return
    const timer = window.setTimeout(() => setMapNotice(null), 3800)
    return () => window.clearTimeout(timer)
  }, [mapNotice])

  const closePhone = useCallback(() => {
    phoneActive.current = false
    setPhoneOpen(false)
  }, [])

  function openPhone() {
    clearInputs()
    phoneActive.current = true
    setSeen(delivered.length)
    setPhoneOpen(true)
  }

  function emp() {
    const current = run.current
    if (!current) return
    fireEmp(current, audio.play)
    setHud(snapshot(current))
  }

  function toggleSound() {
    const next = !sound
    audio.setEnabled(next)
    saveSoundPreference(next)
    setSound(next)
  }

  function continuePortrait() {
    setPortraitSkipped(true)
    try { sessionStorage.setItem(portraitKey, "yes") } catch {}
  }

  useEffect(() => {
    if (rotateRequired) rotateButton.current?.focus({ preventScroll: true })
    else if (hud.phase === "playing") canvas.current?.focus({ preventScroll: true })
    else if (hud.phase === "hacking") document.getElementById("rt-hack-dialog")?.focus({ preventScroll: true })
    else if (hud.phase !== "complete") primary.current?.focus({ preventScroll: true })
  }, [hud.phase, rotateRequired])

  useEffect(() => {
    const current = run.current
    if (hud.phase === "complete" && current?.phase === "complete" && recordedRun.current !== current) {
      recordedRun.current = current
      const result = resultFor(current.difficulty, current.score, current.time, current.alerts)
      audio.playRankReveal(result.rank)
      onComplete(result)
    }
  }, [audio, hud.phase, onComplete])

  useEffect(() => {
    const query = window.matchMedia(portraitQuery)
    const update = () => setPortrait(query.matches)
    query.addEventListener("change", update)
    update()
    return () => query.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    rotateActive.current = rotateRequired
    if (rotateRequired) {
      clearInputs()
      closePhone()
    }
  }, [closePhone, rotateRequired])

  useEffect(() => {
    if (phoneOpen) setSeen(delivered.length)
  }, [delivered.length, phoneOpen])

  const pushId = latest ? `${attempt}-${latest.id}` : ""
  useEffect(() => {
    if (!pushId) return
    const timeout = window.setTimeout(() => setDismissedPush(pushId), 3500)
    return () => window.clearTimeout(timeout)
  }, [pushId])

  useEffect(() => {
    const element = canvas.current
    const field = element?.parentElement
    const ctx = element?.getContext("2d", { alpha: false })
    if (!element || !field || !ctx) return

    run.current = createRun()
    audio.setEnabled(readSoundPreference())
    const paint = createRenderer(ctx)
    const touchControls = window.matchMedia(touchQuery)
    const desktop = window.matchMedia(sidePanelQuery)
    const reducedMotion = window.matchMedia(reducedMotionQuery)
    let lastShake = 0
    let displayWidth = 1
    let displayHeight = 1
    let canvasLeft = 0
    let canvasTop = 0
    let frame = 0
    let previous = 0
    let lastHud = 0
    let lastPhase: Phase = "briefing"
    let lastDpr = 0
    let warnedRun: Run | null = null

    function syncTouchMode() {
      setTouchMode(touchControls.matches)
    }

    function resize() {
      const node = canvas.current
      const container = node?.parentElement
      if (!node || !container) return
      const width = container.clientWidth
      const height = container.clientHeight
      const fit = Math.min(width / mapSize.width, height / mapSize.height)
      const fixedAspect = desktop.matches
      displayWidth = Math.max(1, fixedAspect ? mapSize.width * fit : width)
      displayHeight = Math.max(1, fixedAspect ? mapSize.height * fit : height)
      canvasLeft = fixedAspect ? (width - displayWidth) / 2 : 0
      canvasTop = fixedAspect ? (height - displayHeight) / 2 : 0
      node.style.width = fixedAspect ? `${displayWidth}px` : ""
      node.style.height = fixedAspect ? `${displayHeight}px` : ""
      lastDpr = window.devicePixelRatio || 1
      node.width = Math.max(1, Math.round(displayWidth * lastDpr))
      node.height = Math.max(1, Math.round(displayHeight * lastDpr))
    }

    const playStepEffect: Parameters<typeof stepRun>[3] = effect => {
      if (effect !== "playMissionVictory") audio.play(effect)
    }

    function animate(now: number) {
      const current = run.current
      if (!current) return
      if (lastDpr !== (window.devicePixelRatio || 1)) resize()

      const vector = movementInput.current
      vector.x = stick.current.vector.x
      vector.y = stick.current.vector.y
      for (const code of keys.current) {
        const direction = movement.get(code)
        if (!direction) continue
        if (direction.x) vector.x += direction.x
        if (direction.y) vector.y += direction.y
      }
      vector.x = Math.max(-1, Math.min(1, vector.x))
      vector.y = Math.max(-1, Math.min(1, vector.y))

      const dt = previous ? Math.min(.033, (now - previous) / 1000) : 0
      previous = now
      if (!phoneActive.current && !rotateActive.current && !document.hidden) stepRun(current, dt, vector, playStepEffect)
      if (current.phase === "playing" && current.exposed && current.alert > .15 && warnedRun !== current) {
        warnedRun = current
        setMapNotice({ kind: "detected" })
      }
      if (current.shake > lastShake && !reducedMotion.matches) {
        element?.animate([
          { transform: "translate(0, 0)" },
          { transform: "translate(-4px, 2px)" },
          { transform: "translate(3px, -2px)" },
          { transform: "translate(-2px, 1px)" },
          { transform: "translate(0, 0)" },
        ], { duration: 200, easing: "ease-out" })
      }
      lastShake = current.shake
      if (current.phase !== lastPhase || ((current.phase === "playing" || current.phase === "hacking") && now - lastHud >= 65)) {
        if (current.phase !== "playing") clearInputs()
        setHud(snapshot(current))
        lastPhase = current.phase
        lastHud = now
      }
      const target = paint(current, desktop.matches ? mapSize.width : displayWidth, nicknameOnCanvas.current, reducedMotion.matches)
      if (target && mapAction.current) {
        const side = target.x < .5 ? 1 : -1
        const inset = mapAction.current.offsetWidth / 2 + 6
        const center = Math.max(inset, Math.min(displayWidth - inset, target.x * displayWidth + side * (inset + 20)))
        mapAction.current.style.left = `${canvasLeft + center}px`
        mapAction.current.style.top = `${canvasTop + Math.max(56, Math.min(displayHeight - 50, target.y * displayHeight))}px`
      }
      frame = requestAnimationFrame(animate)
    }

    function onKeyDown(event: KeyboardEvent) {
      const current = run.current
      if (!current || phoneActive.current || rotateActive.current || document.hidden ||
          current.phase === "hacking" || current.phase === "briefing" || event.altKey || event.ctrlKey || event.metaKey) return
      if (movement.has(event.code)) {
        if (current.phase !== "playing") return
        event.preventDefault()
        if (!event.repeat) keys.current.add(event.code)
      } else if (event.code === "KeyR") {
        event.preventDefault()
        if (!event.repeat) begin()
      } else if (event.code === "KeyE" && current.phase === "playing") {
        event.preventDefault()
        if (!event.repeat) enterHack()
      } else if (event.code === "Space" && current.phase === "playing" &&
          !(event.target instanceof HTMLElement && event.target.closest("button, a"))) {
        event.preventDefault()
        if (!event.repeat) emp()
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      keys.current.delete(event.code)
    }

    function onVisibilityChange() {
      clearInputs()
      setHidden(document.hidden)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(field)
    desktop.addEventListener("change", resize)
    touchControls.addEventListener("change", syncTouchMode)
    syncTouchMode()
    resize()
    frame = requestAnimationFrame(animate)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", clearInputs)
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      desktop.removeEventListener("change", resize)
      touchControls.removeEventListener("change", syncTouchMode)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", clearInputs)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [audio])

  function moveStick(event: PointerEvent<HTMLDivElement>) {
    if (stick.current.id !== event.pointerId) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left - bounds.width / 2
    const y = event.clientY - bounds.top - bounds.height / 2
    const radius = bounds.width * .33
    const distance = Math.max(radius, Math.hypot(x, y))
    const vector = { x: x / distance, y: y / distance }
    stick.current.vector = vector
    setKnob({ x: vector.x * radius, y: vector.y * radius })
  }

  function releaseStick(event: PointerEvent<HTMLDivElement>) {
    if (stick.current.id !== event.pointerId) return
    stick.current = { id: -1, vector: neutral }
    setKnob(neutral)
  }

  const playing = hud.phase === "playing"
  const hacking = hud.phase === "hacking"
  const briefing = hud.phase === "briefing"
  const completed = hud.phase === "complete"
  const target = findings[hud.focus]
  const unread = delivered.length - seen
  const SoundIcon = sound ? Volume2 : VolumeX

  return (
    <main className="rt-page" aria-label="Проникновение в офис">
      <style>{mapPopMotion}</style>
      <div className="rt-shell" inert={rotateRequired || briefing || completed}>
        <header className="rt-header" inert={hacking}>
          <a className="inline-flex shrink-0 cursor-pointer transition-opacity hover:opacity-85" href="#home" title="На главную" aria-label="WorkLab — на главную">
            <BrandLogo />
          </a>
          <div className="rt-mission min-w-0 wrap-anywhere">
            <span>Red Team · Белый хакер</span>
            <h1>Проникновение в офис</h1>
          </div>
          <nav className="flex shrink-0 items-center gap-2" aria-label="Навигация по сайту">
            <a className="rt-button rt-back" href="#game" aria-label="К выбору игр" title="Выбор игры">
              <ArrowLeft size={16} aria-hidden="true" /><span className="hidden sm:inline">Игры</span>
            </a>
            <a className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-white/12 bg-white/6 px-2 py-1.5 text-xs font-medium text-white/85 transition-colors hover:bg-white/12 hover:text-white sm:px-3 sm:text-sm"
              href="#home" aria-label="Главная" title="На главную">
              <Home size={16} aria-hidden="true" /><span className="hidden sm:inline">Главная</span>
            </a>
          </nav>
        </header>

        <div className="rt-hud" aria-label="Панель операции" inert={hacking}>
          <nav className="rt-compact-back items-center gap-1 w-auto!" aria-label="Навигация по сайту">
            <a className="rt-button rt-icon" href="#game" aria-label="К выбору игр" title="Выбор игры"><ArrowLeft size={16} aria-hidden="true" /></a>
            <a className="rt-button rt-icon" href="#home" aria-label="Главная" title="На главную"><Home size={16} aria-hidden="true" /></a>
          </nav>
          <div className="rt-count"><Crosshair size={17} aria-hidden="true" /><span>Уязвимости</span> <strong>{hud.count}/{findings.length}</strong></div>
          <div className="rt-alert" data-exposed={hud.exposed} data-level={hud.alert >= 70 ? "danger" : hud.alert >= 35 ? "warning" : "low"}>
            <div><span>Обнаружение</span><strong>{hud.alert}%</strong></div>
            <progress max={100} value={hud.alert} aria-label="Обнаружение" />
          </div>
          <time className="rt-time" aria-label="Время забега">{formatTime(hud.time)}</time>
          <div className="rt-score">
            <span>Очки</span><strong key={hud.score} data-gain={hud.score > 0}>{hud.score}</strong>
            <span className="ml-0.5 whitespace-nowrap rounded-md border border-[#8EE872]/28 bg-[#8EE872]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#8EE872]"
              title="Сложность забега">{difficulties[hud.difficulty].label}</span>
          </div>
          <div className="rt-hud-actions">
            <button className="rt-button rt-emp" type="button" onClick={emp} disabled={!playing || hud.charges === 0}>
              <Zap size={16} aria-hidden="true" /> EMP <kbd>Пробел</kbd> <strong>{hud.charges}</strong>
            </button>
            <button className="rt-button rt-icon" type="button" onClick={toggleSound} aria-label={sound ? "Выключить звук" : "Включить звук"} title={sound ? "Выключить звук" : "Включить звук"}>
              <SoundIcon size={18} aria-hidden="true" />
            </button>
            <button className="rt-button rt-icon" type="button" onClick={begin} disabled={briefing} aria-label="Начать заново" title="Начать заново (R)">
              <RotateCcw size={17} aria-hidden="true" />
            </button>
            <button className="rt-button rt-chat-toggle" type="button" onClick={openPhone} aria-haspopup="dialog" aria-expanded={phoneOpen}
              aria-label={unread > 0 ? `Чат, новых сообщений ${unread}` : "Чат"}>
              <MessageCircle size={16} aria-hidden="true" /><span>Чат</span>
              {unread > 0 && <strong aria-hidden="true">{unread}</strong>}
            </button>
          </div>
        </div>

        <div className="rt-operation">
        <div className="rt-gameboard">
        <div className="rt-layout">
          <div className="rt-field" data-briefing={briefing} data-exposed={hud.exposed} inert={hacking}>
            <canvas ref={canvas} tabIndex={playing ? 0 : -1} aria-label="Карта офиса банка" />
            <div className="rt-vignette" aria-hidden="true" />
            {playing && <MapGuide count={hud.count} notice={mapNotice} touch={touchMode} />}
            {playing && target && <button className="absolute top-1/2 left-1/2 z-20 min-h-9 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-lg border border-[#D1FFB9] bg-[#8EE872] px-2.5 py-1.5 text-xs font-extrabold whitespace-nowrap text-[#0D120F] shadow-[0_3px_0_#42783C,0_7px_18px_rgba(0,0,0,0.65)] hover:bg-[#AEF89A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-sm"
              ref={mapAction} type="button" onClick={enterHack}>
              {touchMode ? "Взломать" : "Нажми E · Взломать"}
            </button>}
          </div>
          {hacking && target && puzzles && (
            <HackPuzzleModal key={`${attempt}:${puzzles.difficulty}:${puzzles.variants[target.puzzle].id}`}
              variant={puzzles.variants[target.puzzle]} difficulty={puzzles.difficulty} label={target.short} alert={hud.alert} play={audio.play} paused={rotateRequired || hidden}
              onCancel={leaveHack} onSuccess={handleHackSuccess} onFailure={handleHackFailure} />
          )}
          {hud.phase === "caught" && (
            <div className="rt-overlay" data-phase={hud.phase}>
              {caughtByTrap && <div className="pointer-events-none absolute inset-0 motion-safe:animate-[rt-canary-flash_.48s_ease-out]" aria-hidden="true" />}
              <section className="rt-dialog" role="dialog" aria-labelledby="rt-dialog-title">
                <div className="rt-dialog-label"><Crosshair size={16} aria-hidden="true" /> Тревога 100%</div>
                <h2 id="rt-dialog-title">Агент обнаружен</h2>
                <p>{caughtByTrap ? honeytokenAlert : "Используй стены как укрытия или отключай охрану с помощью EMP."}</p>
                <div className="mt-3"><DifficultyPicker value={difficulty} onChange={changeDifficulty} compact /></div>
                <div className="rt-dialog-actions">
                  <button className="rt-button rt-primary" ref={primary} type="button" onClick={begin}>Начать заново <kbd>R</kbd></button>
                  <a className="rt-button" href="#game">К выбору игр</a>
                </div>
              </section>
            </div>
          )}
        </div>

        {playing && (
          <>
            <div className="rt-touch-controls" aria-label="Сенсорное управление">
              <div className="rt-stick" aria-label="Джойстик"
                onPointerDown={event => {
                  if (stick.current.id >= 0) return
                  event.currentTarget.setPointerCapture(event.pointerId)
                  stick.current.id = event.pointerId
                  moveStick(event)
                }}
                onPointerMove={moveStick} onPointerUp={releaseStick} onPointerCancel={releaseStick} onLostPointerCapture={releaseStick}>
                <span style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
              </div>
              <span className="rt-touch-instruction">{hud.count === findings.length ? "Иди к ядру" : target ? "Точка рядом" : "Войди в круг"}</span>
              <button className="rt-button rt-emp" type="button" disabled={hud.charges === 0} onClick={emp}><Zap size={16} aria-hidden="true" /> EMP <strong>{hud.charges}</strong></button>
              <button className="rt-button rt-scan" type="button" disabled={!target} onClick={enterHack}>
                <ScanLine size={16} aria-hidden="true" /> Взлом
              </button>
            </div>
            <div className="rt-legend rt-desktop-help">
              <span><kbd>WASD</kbd> / <kbd>↑ ↓ ← →</kbd> Движение</span>
              <span><kbd>E</kbd> Взломать точку в кольце</span>
              <span><kbd>R</kbd> Заново</span>
            </div>
          </>
        )}
        </div>
          <div className="rt-phone-slot" inert={hacking}>
            <AgentPhone events={hud.events} delivered={delivered} typing={typing} open={phoneOpen} onClose={closePhone} />
          </div>
        </div>
        {latest && unread > 0 && pushId !== dismissedPush && !phoneOpen && !hacking &&
          <MessagePush key={pushId} message={latest} onOpen={openPhone} />}
      </div>
      {briefing && !rotateRequired && (
        <div className={missionOverlay}>
          <section className={missionDialog} role="dialog" aria-modal="true" aria-labelledby="rt-briefing-title">
            <div className="h-1.5 bg-linear-to-r from-[#8EE872] to-emerald-400" aria-hidden="true" />
            <form className="grid gap-3 p-3.5 sm:p-5 [@media(max-height:430px)]:gap-2 [@media(max-height:430px)]:p-3 [@media(orientation:landscape)_and_(max-height:430px)_and_(min-width:640px)]:grid-cols-[minmax(0,1.25fr)_minmax(17rem,1fr)]" onSubmit={event => {
              event.preventDefault()
              startOperation()
            }}>
              <header>
                <div className="text-[11px] font-extrabold tracking-wider text-[#8EE872]">ГЛАВА 2 · ПОНЕДЕЛЬНИК, 09:30</div>
                <h2 id="rt-briefing-title" className="mt-1 text-xl leading-tight font-extrabold sm:text-2xl">Проникновение в офис</h2>
                <p className="mt-2 text-sm leading-snug text-[#CFDCD0] [@media(max-height:430px)]:mt-1 [@media(max-height:430px)]:text-xs">Пятничный релиз спасён. Теперь выясни, как «Призрак» узнал внутренние адреса банка. Начни с гостевого Wi-Fi и проверь журнал Ядра.</p>
              </header>
              <div className="min-w-0 self-center">
                <PlayerNicknameField hint="Виден над персонажем" placeholder="Например, Ghost_01" value={nicknameDraft} onChange={setNicknameDraft} />
              </div>
              <div className="col-span-full">
                <DifficultyPicker value={difficulty} onChange={changeDifficulty} />
              </div>
              <div className="col-span-full flex items-center justify-between gap-3 border-t border-white/[0.08] pt-4 [@media(max-height:430px)]:pt-2">
                <a className={`${missionBack} px-2 sm:px-3`} href="#game"><ArrowLeft size={15} className="shrink-0" aria-hidden="true" /> К выбору игр</a>
                <button className={`${missionPrimary} sm:px-5`} ref={primary} type="submit">Начать операцию →</button>
              </div>
            </form>
          </section>
        </div>
      )}
      {completed && (
        <OperationResult hud={hud} playerNickname={playerNickname} puzzleErrors={puzzleErrors.current} difficulty={difficulty} onDifficulty={changeDifficulty} onRestart={begin} hidden={rotateRequired} />
      )}
      {rotateRequired && (
        <div className="rt-rotate" role="dialog" aria-modal="true" aria-labelledby="rt-rotate-title">
          <div>
            <Smartphone size={58} aria-hidden="true" />
            <h2 id="rt-rotate-title">Поверни телефон горизонтально</h2>
            <p>Так карта офиса, камеры и управление будут на весь экран.</p>
            <button ref={rotateButton} className="rt-button" type="button" onClick={continuePortrait}>
              Всё равно продолжить вертикально
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
