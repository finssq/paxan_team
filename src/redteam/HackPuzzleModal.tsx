import { CarFront, Cat, Check, Clock3, Coffee, Contact, Dog, Globe, LockKeyhole, Shield, StickyNote, Terminal, Usb } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { CSSProperties, KeyboardEvent } from "react"
import { createPortal } from "react-dom"
import type { createSfx } from "../audio/sfx"
import { shuffleArray } from "../shuffleArray"
import type { FileExtension, NetworkCard, PuzzleVariant } from "./puzzleVariants"

const fileTones = {
  ENV: "text-[#E5BE7A]", KEY: "text-[#B0CB91]", PNG: "text-[#DDB0A1]", JPG: "text-[#DDB0A1]",
  SVG: "text-[#A8C7BA]", TXT: "text-[#C6D0C8]", PDF: "text-[#C6D0C8]", CSV: "text-[#A8C7BA]", ZIP: "text-[#D6C3A1]",
} satisfies Record<FileExtension, string>

const networkTones: Record<NetworkCard["tone"], string> = {
  secure: "bg-[#162920] text-[#8EE872] ring-1 ring-[#8EE872]/35 ring-inset",
  amber: "bg-[#F59E0B] text-[#0B0F0C]",
  coral: "bg-[#EF4444] text-white",
  closed: "bg-white/10 text-white/75",
}

const clueIcons = { cat: Cat, dog: Dog, cup: Coffee, car: CarFront }
const accent = {
  sniffer: "from-[#34D399] to-[#8EE872]",
  laptop: "from-[#8EE872] to-[#8EE872]",
  osint: "from-[#8EE872] to-[#59C68A]",
}
function FileIcon({ extension }: { extension: FileExtension | null }) {
  if (extension === null) {
    return (
      <span className="grid h-12 w-12 place-items-center" aria-hidden="true">
        <span className="flex h-11 w-12 flex-col overflow-hidden rounded-lg border border-white/15 bg-[#1F2923] text-[#B8C8BD]">
          <span className="flex h-3 shrink-0 items-center gap-0.5 border-b border-white/10 px-1.5">
            <i className="size-[3px] rounded-full bg-current" /><i className="size-[3px] rounded-full bg-current" /><i className="size-[3px] rounded-full bg-current" />
          </span>
          <span className="grid flex-1 place-items-center"><Globe size={17} /></span>
        </span>
      </span>
    )
  }

  return (
    <span className="relative flex h-12 w-11 items-end justify-center rounded-lg rounded-tr-[13px] border border-white/15 bg-[#1F2923] pb-1.5" aria-hidden="true">
      <span className="absolute top-0 right-0 size-3.5 rounded-bl-sm bg-[#56665C] [clip-path:polygon(0_0,0_100%,100%_100%)]" />
      <span className={`rounded border border-white/10 bg-black/20 px-1 py-px font-mono text-[10px] font-bold ${fileTones[extension]}`}>.{extension}</span>
    </span>
  )
}

const sniffSounds = ["playPacketSniff1", "playPacketSniff2", "playPacketSniff3"] as const
const limit = 120
const successDuration = 850
const tactile = "cursor-pointer border-2 border-b-[5px] border-white/10 border-b-[#070B08] transition-[background,border-color,translate] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8EE872] active:translate-y-[3px] active:border-b-2 disabled:cursor-default"
const particles = Array.from({ length: 24 }, (_, index) => {
  const angle = index * Math.PI / 12
  const radius = 87 + index % 5 * 15
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, rotation: (index % 2 ? -1 : 1) * (90 + index * 13) }
})
const modalMotion = `
  @keyframes rt-terminal-level { from { transform: scaleY(.28); } to { transform: scaleY(1); } }
  @keyframes rt-terminal-spring { 0% { transform: scale(.88); } 56% { transform: scale(1.07); } 100% { transform: scale(1); } }
  @keyframes rt-terminal-points { 0% { opacity: 0; transform: translateY(5px) scale(.6); } 25% { opacity: 1; transform: translateY(-3px) scale(1.12); } 100% { opacity: 0; transform: translateY(-25px) scale(.98); } }
  @keyframes rt-terminal-confetti { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.3); } 13% { opacity: 1; } 78% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--travel-x), var(--travel-y)) rotate(var(--spin)); } }
  @keyframes rt-terminal-flash { 0% { background-color: rgb(142 232 114 / .42); } 100% { background-color: rgb(8 15 10 / .88); } }
`

function shuffleScenario(variant: PuzzleVariant): PuzzleVariant {
  if (variant.kind === "sniffer") return { ...variant, cards: shuffleArray(variant.cards) }
  if (variant.kind === "osint") return { ...variant, chips: shuffleArray(variant.chips) }
  return variant.mode === "mail"
    ? { ...variant, mail: shuffleArray(variant.mail) }
    : { ...variant, files: shuffleArray(variant.files) }
}

export default function HackPuzzleModal({ variant, label, alert, play, paused, onCancel, onFailure, onSuccess }: {
  variant: PuzzleVariant
  label: string
  alert: number
  play: ReturnType<typeof createSfx>["play"]
  paused: boolean
  onCancel: () => void
  onFailure: (penalty: number) => void
  onSuccess: () => void
}) {
  const dialog = useRef<HTMLElement>(null)
  const locked = useRef(false)
  const elapsed = useRef(0)
  const transitionLeft = useRef(0)
  const callbacks = useRef({ onFailure, onSuccess })
  callbacks.current = { onFailure, onSuccess }
  const [round, setRound] = useState(() => shuffleScenario(variant))
  const [selected, setSelected] = useState<string[]>([])
  const [chips, setChips] = useState<string[]>([])
  const [mistake, setMistake] = useState<{ target: string; text: string; count: number }>()
  const [solved, setSolved] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [remaining, setRemaining] = useState(limit)
  const { kind } = round
  const isSniffer = kind === "sniffer"
  const isOsint = kind === "osint"
  const penalty = kind === "laptop" ? 15 : 20
  const answer = round.kind === "osint" ? round.answer : []

  useEffect(() => {
    dialog.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (paused || solved || reconnecting) return
    let previous = performance.now()
    let lastSecond = Math.ceil(limit - elapsed.current / 1000)
    const countdown = window.setInterval(() => {
      if (locked.current) return
      const now = performance.now()
      elapsed.current += now - previous
      previous = now
      const left = Math.max(0, limit - elapsed.current / 1000)
      setRemaining(left)
      const second = Math.ceil(left)
      if (second > 0 && second <= 10 && second < lastSecond) play("playHackTick")
      lastSecond = second
      if (left > 0) return

      locked.current = true
      transitionLeft.current = 850
      setReconnecting(true)
      setMistake(undefined)
      callbacks.current.onFailure(.25)
    }, 70)
    return () => {
      window.clearInterval(countdown)
      if (!locked.current) elapsed.current += performance.now() - previous
    }
  }, [paused, play, reconnecting, solved])

  useEffect(() => {
    if (paused || (!solved && !reconnecting)) return
    const started = performance.now()
    const timer = window.setTimeout(() => {
      if (solved) {
        callbacks.current.onSuccess()
        return
      }
      elapsed.current = 0
      setRemaining(limit)
      setSelected([])
      setChips([])
      setRound(shuffleScenario(variant))
      locked.current = false
      setReconnecting(false)
      dialog.current?.focus({ preventScroll: true })
    }, transitionLeft.current)
    return () => {
      window.clearTimeout(timer)
      transitionLeft.current = Math.max(0, transitionLeft.current - (performance.now() - started))
    }
  }, [paused, reconnecting, solved, variant])

  function complete() {
    locked.current = true
    transitionLeft.current = successDuration
    setSolved(true)
    play("playHackSuccess")
  }

  function reject(target: string, text: string) {
    setMistake(old => ({ target, text, count: (old?.count ?? 0) + 1 }))
    onFailure(penalty / 100)
  }

  function collect(name: string, error?: string) {
    if (locked.current || selected.includes(name)) return
    if (error) {
      reject(name, error)
      return
    }
    play(isSniffer ? sniffSounds[selected.length] ?? sniffSounds[0] : "playUsbCopy")
    setSelected([...selected, name])
    setMistake(undefined)
    if (selected.length === 2) complete()
  }

  function choose(fragment: string) {
    if (locked.current) return
    const next = chips.length === answer.length ? [fragment] : [...chips, fragment]
    setChips(next)
    setMistake(undefined)
    if (next.length === answer.length) {
      const wrong = next.findIndex((chip, index) => chip !== answer[index])
      if (wrong >= 0) {
        reject(String(wrong), `Не совпал фрагмент №${wrong + 1}. Попробуй снова.`)
        return
      }
    }
    play("playOsintChip")
    if (next.length === answer.length) complete()
  }

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !solved) {
      event.preventDefault()
      onCancel()
    }
    if (event.key !== "Tab") return
    const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")
    const first = buttons?.[0]
    const last = buttons?.[buttons.length - 1]
    if (!first || (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current))) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const seconds = Math.ceil(remaining)
  const time = [Math.floor(seconds / 60), seconds % 60].map(value => String(value).padStart(2, "0")).join(":")
  const critical = seconds <= 10
  const timerFill = critical ? "from-[#EF4444] to-[#F87171] motion-safe:animate-pulse"
    : seconds <= 25 ? "from-[#F59E0B] to-[#D97706]" : "from-[#8EE872] to-[#34D399]"
  const timerPill = critical ? "bg-[#EF4444] text-[#180A08]" : seconds <= 25 ? "bg-[#F59E0B] text-[#0B0F0C]"
    : "bg-[#8EE872] text-[#08120B]"
  const disabled = solved || reconnecting
  const ClueIcon = round.kind === "osint" ? clueIcons[round.pictogram] : Cat
  const progress = [0, 1, 2].map(index => isOsint ? chips[index] === answer[index] : index < selected.length)

  function mistakeStyle(target: string) {
    if (mistake?.target !== target) return ""
    return mistake.count % 2 === 0
      ? "border-[#EF4444]! motion-safe:animate-[rt-miss-repeat_.32s_ease-out]"
      : "border-[#EF4444]! motion-safe:animate-[rt-miss_.32s_ease-out]"
  }

  return createPortal(
    <div className={paused ? "hidden" : "fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-4"}>
      <style>{modalMotion}</style>
      <div className="relative w-full min-w-0 max-w-2xl">
        <section className="rt-hack max-h-[min(94dvh,calc(100dvh-24px))]! w-full! overscroll-contain overflow-y-auto rounded-3xl border-2 border-white/10! bg-none! bg-[#0D120F]! p-0! text-white shadow-[0_30px_90px_rgba(0,0,0,0.85)] sm:max-h-[min(94dvh,calc(100dvh-32px))]!"
          ref={dialog} id="rt-hack-dialog" tabIndex={-1} role="dialog" aria-modal="true" data-reconnecting={reconnecting || undefined}
          aria-labelledby="rt-hack-title" aria-describedby="rt-hack-rule" onKeyDown={handleKey}>
          <div className={`h-1.5 bg-linear-to-r ${accent[kind]}`} aria-hidden="true" />
          <div className="space-y-2 p-3 sm:p-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex flex-wrap items-center gap-2 text-xs font-extrabold tracking-wide text-[#8EE872]">
                <Terminal size={15} aria-hidden="true" /> {label}
                <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] text-[#C0CDC1]">Сценарий {round.number}/{round.total}</span>
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {isSniffer && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8EE872]/50 bg-[#8EE872]/10 px-2 py-1 font-mono text-[11px] font-extrabold text-[#8EE872]">
                    LIVE <span className="flex h-4 items-center gap-[2px]" aria-hidden="true">
                      {[10, 15, 8, 16, 11].map((height, index) => (
                        <i className="w-0.5 rounded-full bg-[#8EE872] shadow-[0_0_7px_#8EE872] motion-safe:animate-[rt-terminal-level_.6s_ease-in-out_infinite_alternate]"
                          key={index} style={{ height, animationDelay: `${index * -115}ms` }} />
                      ))}
                    </span>
                  </span>
                )}
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono font-extrabold tabular-nums ${timerPill}`}>
                  {kind === "laptop" && <><Clock3 size={15} aria-hidden="true" /><span className="text-xs">До блокировки ·</span></>}<strong className="text-base">{time}</strong>
                </span>
                <button className={`${tactile} rounded-xl border-white/9 border-b-[#080C09] bg-[#18211C] px-2.5 py-1.5 text-xs font-bold hover:border-[#8EE872]/60 hover:bg-[#1F2B24]`}
                  type="button" disabled={solved} onClick={onCancel}>Отмена <kbd className="rounded border border-white/10 bg-white/5 px-1 py-px font-mono text-[11px] text-[#C8DFCA]">Esc</kbd></button>
              </div>
            </header>
            <h2 className="min-w-0 wrap-anywhere text-xl leading-tight font-extrabold sm:text-2xl" id="rt-hack-title">{round.title}</h2>
            <div className="h-2 overflow-hidden rounded-full bg-[#26342B]" role="progressbar" aria-label="Оставшееся время"
              aria-valuemin={0} aria-valuemax={limit} aria-valuenow={seconds} aria-valuetext={time}>
              <div className={`h-full rounded-full bg-linear-to-r shadow-[0_0_12px_#8EE87255] transition-[width] duration-100 ${timerFill}`}
                style={{ width: `${remaining / limit * 100}%` }} />
            </div>
            <p className="mb-3 text-sm leading-snug text-[#DFE8DF]!" id="rt-hack-rule">{round.rule}</p>

            {round.kind === "sniffer" ? (
              <div className="grid grid-cols-2 gap-2">
                {round.cards.map(packet => {
                  const captured = selected.includes(packet.name)
                  return (
                    <button className={`${tactile} relative grid min-w-0 gap-1 rounded-2xl border-b-[3px]! px-3 py-2 text-left hover:border-[#8EE872]/60 ${mistakeStyle(packet.name)} ${
                      captured ? "border-[#8EE872]! bg-[#8EE872]/20" : "bg-[#151D18] hover:bg-[#1C2720]"
                    }`} type="button" disabled={disabled} aria-disabled={captured || disabled}
                      key={packet.name} onClick={() => collect(packet.name, packet.error)}>
                      <span className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-extrabold">
                        <span className={`rounded-full px-2 py-0.5 ${packet.source === "ГОСТЬ" ? "bg-white/10 text-white/65" : "bg-[#ECFDF5] text-[#08120B]"}`}>{packet.source}</span>
                        {captured && <span className="inline-flex items-center gap-1 rounded-full bg-[#8EE872] px-2 py-0.5 text-[#102416]"><Check size={12} aria-hidden="true" /> ПОЙМАН</span>}
                        <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${networkTones[packet.tone]}`}>
                          {packet.tone === "secure" && <LockKeyhole size={12} aria-hidden="true" />} {packet.status}
                        </span>
                      </span>
                      <span className="min-w-0 wrap-anywhere text-sm leading-snug font-bold text-white">{packet.name}</span>
                      {captured && <Bonus>+100</Bonus>}
                    </button>
                  )
                })}
              </div>
            ) : round.kind === "laptop" ? (
              <div className="overflow-hidden rounded-2xl border border-white/9 bg-[#111814]">
                <div className="flex flex-wrap items-center gap-2 border-b border-white/9 bg-[#161F1A] px-3 py-2 text-xs font-bold text-[#EDF3ED]">
                  <span className="flex gap-1.5" aria-hidden="true">
                    <i className="size-2 rounded-full bg-[#EF4444]" /><i className="size-2 rounded-full bg-[#F59E0B]" /><i className="size-2 rounded-full bg-[#8EE872]" />
                  </span>
                  {round.windowTitle}
                </div>
                {round.mode === "mail" ? (
                  <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2">
                    {round.mail.map(({ sender, subject, preview, error }) => {
                      const copied = selected.includes(subject)
                      return (
                        <button type="button" disabled={disabled} aria-disabled={copied || disabled}
                          className={`${tactile} relative grid min-w-0 gap-0.5 rounded-xl border-b-[3px]! px-2.5 py-1 text-left hover:border-[#8EE872]/60 ${mistakeStyle(subject)} ${
                            copied ? "border-[#8EE872]! bg-[#8EE872]/15" : "bg-[#18211C] hover:bg-[#1F2B24]"
                          }`} key={subject} onClick={() => collect(subject, error)}>
                          <span className="text-[10px] leading-tight font-medium text-[#B9C8BB]">{sender}</span>
                          <strong className="text-sm leading-tight text-white">{subject}</strong>
                          <span className="truncate text-xs leading-tight text-[#C0CDC1]" title={preview}>«{preview}»</span>
                          {copied && <Bonus>+100</Bonus>}
                        </button>
                      )
                    })}
                  </div>
                ) : <div className="grid grid-cols-2 gap-2.5 p-2.5 sm:grid-cols-4">
                  {round.files.map(file => {
                    const { name, size, extension } = file
                    const copied = selected.includes(name)
                    return (
                      <button className={`${tactile} relative flex min-w-0 flex-col items-center gap-1 rounded-2xl border-white/9 border-b-[#080C09] p-2.5 text-center hover:-translate-y-0.5 hover:border-[#8EE872]/60 ${mistakeStyle(name)} ${
                        copied ? "border-[#8EE872]! bg-[#8EE872]/15" : "bg-[#18211C] hover:bg-[#1F2B24]"
                      }`} type="button" disabled={disabled} aria-disabled={copied || disabled}
                        key={name} onClick={() => collect(name, file.error)}>
                        <FileIcon extension={extension} />
                        <span className="w-full min-w-0 wrap-anywhere text-[13px] leading-tight font-bold whitespace-normal text-white">{name}</span>
                        <span className="text-[11px] text-[#C0CDC1]">{copied ? "✓ Скопировано" : size}</span>
                        {copied && <Bonus>+100</Bonus>}
                      </button>
                    )
                  })}
                </div>}
                <div className="border-t border-[#8EE872]/25 bg-[#161F1A] p-2.5">
                  <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#8EE872]"><Usb size={18} aria-hidden="true" /> USB RedTeam</div>
                  <ProgressSlots completed={progress} />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 items-start gap-2.5 min-[410px]:grid-cols-3">
                  <div className="grid min-w-0 gap-2 rounded-2xl border border-white/30 bg-linear-to-br from-[#164E38] to-[#0D2E21] p-3 text-white shadow-[inset_0_3px_0_#8EE872,0_10px_25px_rgba(0,0,0,0.45)]">
                    <span className="mx-auto h-1 w-8 rounded-full bg-[#8EE872]" aria-hidden="true" />
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold"><Contact size={16} aria-hidden="true" /> Пропуск</span>
                    <strong className="wrap-anywhere text-sm leading-snug">{round.badge}</strong>
                    <span className="w-fit rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-extrabold text-[#123525]">{round.role}</span>
                  </div>
                  <div className="grid min-w-0 -rotate-1 gap-2 rounded-2xl border-2 border-white bg-[#F3F5F3] p-2.5 text-[#0D1410] shadow-lg">
                    <span className="grid min-h-10 place-items-center rounded-lg bg-linear-to-br from-[#F59E0B] to-[#EA580C] text-white"><ClueIcon size={27} aria-hidden="true" /></span>
                    <strong className="wrap-anywhere text-sm leading-snug">{round.photo}</strong>
                  </div>
                  <div className="grid min-w-0 rotate-1 gap-2 rounded-xl border-b-4 border-[#D99A18] bg-[#FDE047] p-3 text-[#18181B] shadow-[0_14px_28px_rgba(0,0,0,0.55)]">
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold"><StickyNote size={16} aria-hidden="true" /> Стикер</span>
                    <strong className="wrap-anywhere text-sm leading-snug">{round.note}</strong>
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto] items-center gap-1.5" aria-label="Фрагменты пароля">
                  {answer.map((expected, index) => {
                    const filled = chips[index] === expected
                    const wrong = Boolean(mistake) && chips[index] !== expected
                    const active = !disabled && !mistake && chips.length === index
                    const tone = filled ? "border-[#8EE872] bg-[#8EE872]/15 text-[#8EE872]" : active
                      ? "border-[#8EE872] bg-[#0B110D] text-[#8EE872] shadow-[0_0_20px_rgba(142,232,114,0.3)]"
                      : "border-[#3F5146] bg-[#0B110D] text-[#DFE8DF]"
                    return (
                      <span className={`relative grid h-11 min-w-0 place-items-center rounded-2xl border-2 font-mono text-base font-extrabold sm:text-xl ${tone} ${
                        wrong ? "border-[#EF4444]! text-[#FFBCB1]! motion-safe:animate-[rt-miss_.32s_ease-out]" : ""
                      }`} key={index}>{chips[index] ?? "?"}
                        {filled && <Bonus>ЕСТЬ!</Bonus>}
                      </span>
                    )
                  })}
                  <button className={`${tactile} rounded-xl bg-[#18211C] px-2 py-2 text-xs font-extrabold hover:bg-[#1C2720] disabled:opacity-60`}
                    type="button" disabled={!chips.length || disabled} onClick={() => {
                      setChips([])
                      setMistake(undefined)
                      setRound(current => current.kind === "osint" ? shuffleScenario(current) : current)
                    }}>Сброс</button>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {round.chips.map(fragment => (
                    <button className={`${tactile} min-w-0 rounded-2xl bg-[#18211C] px-1 py-2 font-mono text-base font-extrabold shadow-md hover:border-[#8EE872]/60 hover:bg-[#1F2B24] data-[picked=true]:translate-y-0.5 data-[picked=true]:border-[#8EE872]/55 data-[picked=true]:bg-[#8EE872]/15 data-[picked=true]:text-[#8EE872]`}
                      type="button" disabled={disabled} data-picked={chips.includes(fragment)} key={fragment} onClick={() => choose(fragment)}>{fragment}</button>
                  ))}
                </div>
              </>
            )}

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
              {kind !== "laptop" && (
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 text-xs font-extrabold text-[#DFE8DF]">{isOsint ? "Фрагменты" : "Перехват"}</div>
                  <ProgressSlots completed={progress} />
                </div>
              )}
              <div className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold ${
                alert >= 60 ? "bg-[#EF4444]/20 text-[#FFBCB1]" : alert > 0 ? "bg-[#F59E0B]/20 text-[#FFD489]" : "bg-[#8EE872]/15 text-[#B7F6A4]"
              }`}><Shield size={14} aria-hidden="true" /> Тревога {alert}%</div>
            </div>
            {reconnecting && <p className="rounded-xl bg-[#EF4444]/15 px-3 py-2 text-sm font-bold text-[#FFBCB1]!" role="status">Время вышло — переподключение! Тревога +25%.</p>}
            {mistake && <p className="rounded-xl bg-[#EF4444]/15 px-3 py-2 text-sm font-bold text-[#FFBCB1]!" role="status">{mistake.text} Тревога +{penalty}%.</p>}
          </div>
        </section>
        {solved && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center overflow-hidden rounded-3xl bg-[#080F0A]/90 p-4 text-center motion-safe:animate-[rt-terminal-flash_.85s_ease-out_both]" role="status">
            {particles.map(({ x, y, rotation }, index) => (
              <span className={`absolute top-1/2 left-1/2 h-2 w-1.5 rounded-sm opacity-0 motion-safe:animate-[rt-terminal-confetti_.85s_ease-out_both] ${
                index % 3 === 0 ? "bg-[#F59E0B]" : index % 3 === 1 ? "bg-[#34D399]" : "bg-[#8EE872]"
              }`} aria-hidden="true" key={index}
                style={{ "--travel-x": `${x}px`, "--travel-y": `${y}px`, "--spin": `${rotation}deg` } as CSSProperties} />
            ))}
            <div className="relative grid justify-items-center gap-2 motion-safe:animate-[rt-terminal-spring_.4s_ease-out_both]">
              <Check size={30} className="text-[#8EE872]" aria-hidden="true" />
              <strong className="text-2xl font-extrabold text-[#8EE872] drop-shadow-[0_0_14px_#8EE87288] sm:text-4xl">ВЗЛОМАНО! +250</strong>
              <p className="max-w-sm text-sm leading-snug text-white!">{round.takeaway}</p>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Bonus({ children }: { children: string }) {
  return (
    <span className="pointer-events-none absolute top-1 right-1 z-10 rounded-full bg-[#8EE872] px-1.5 py-0.5 font-mono text-xs font-extrabold text-[#14250D] opacity-0 motion-safe:animate-[rt-terminal-points_.72s_ease-out_both]"
      aria-hidden="true">{children}</span>
  )
}

function ProgressSlots({ completed }: { completed: boolean[] }) {
  return (
    <ol className="grid max-w-[16rem] grid-cols-3 gap-2" aria-label={`Выполнено ${completed.filter(Boolean).length} из 3`}>
      {completed.map((filled, index) => (
        <li className={`grid h-8 place-items-center rounded-xl border-2 font-mono text-base font-extrabold ${
          filled ? "border-[#C6FFAC] bg-[#8EE872] text-[#14250D] shadow-[0_0_14px_#8EE87266] motion-safe:animate-[rt-terminal-spring_.38s_ease-out_both]"
            : "border-white/9 bg-[#18211C] text-[#C0CDC1]"
        }`} key={index}>{filled ? <Check size={20} aria-label="Готово" /> : index + 1}</li>
      ))}
    </ol>
  )
}
