import { Check, Terminal } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { KeyboardEvent, ReactNode } from "react"
import type { createSfx } from "../audio/sfx"
import type { PuzzleKind } from "./mapData"

type PuzzleProps = {
  play: ReturnType<typeof createSfx>["play"]
  onFailure: () => void
  onSuccess: () => void
}

const puzzles: Record<PuzzleKind, { title: string; rule: string }> = {
  frequency: { title: "Перехват частоты", rule: "Нажми Пробел или «Зафиксировать», когда метка войдёт в зелёную зону." },
  circuit: { title: "Обход защиты", rule: "Поворачивай плитки, чтобы соединить вход с точкой доступа." },
  memory: { title: "Взлом клавиатуры", rule: "Запомни подсветку и повтори порядок клавиш." },
}

const channelPeriods = [2900, 2540, 2180] as const

function FrequencyPuzzle({ play, onFailure, onSuccess }: PuzzleProps) {
  const [channel, setChannel] = useState(0)
  const [miss, setMiss] = useState(false)
  const indicator = useRef<HTMLSpanElement>(null)
  const origin = useRef(performance.now())
  const lockedUntil = useRef(0)
  const reset = useRef<number | undefined>(undefined)

  function position(now: number) {
    const period = channelPeriods[channel] ?? channelPeriods[0]
    const progress = ((now - origin.current) / period) % 1
    return (1 - Math.abs(progress * 2 - 1)) * 100
  }

  useEffect(() => {
    let frame = 0
    function animate(now: number) {
      if (indicator.current) indicator.current.style.left = `${position(now)}%`
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [channel])

  useEffect(() => () => window.clearTimeout(reset.current), [])

  function capture() {
    const now = performance.now()
    if (now < lockedUntil.current) return
    const value = position(now)
    if (value < 36 || value > 64) {
      lockedUntil.current = now + 420
      setMiss(true)
      reset.current = window.setTimeout(() => setMiss(false), 410)
      onFailure()
      return
    }
    play("officeFrequency")
    if (channel === channelPeriods.length - 1) {
      onSuccess()
      return
    }
    origin.current = now
    lockedUntil.current = now + 250
    setChannel(channel + 1)
  }

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.code !== "Space" ||
          (event.target instanceof HTMLElement && event.target.closest(".rt-puzzle-cancel"))) return
      event.preventDefault()
      if (!event.repeat) capture()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [channel, onFailure, onSuccess, play])

  return (
    <div className="rt-frequency" data-miss={miss}>
      {channelPeriods.map((_, index) => (
        <div className="rt-channel" data-current={channel === index} data-done={index < channel} key={index}>
          <span>Канал {index + 1}</span>
          <div className="rt-channel-track">
            <span className="rt-channel-zone" />
            {channel === index && <span className="rt-channel-cursor" ref={indicator} />}
          </div>
          {index < channel && <Check size={17} aria-label="Зафиксирован" />}
        </div>
      ))}
      <p className="rt-puzzle-status" role="status">{miss ? "Промах · тревога +25%" : `Зафиксировано ${channel}/3`}</p>
      <button className="rt-button rt-primary" type="button" onClick={capture}>Зафиксировать <kbd>Пробел</kbd></button>
    </div>
  )
}

const directions = [
  { bit: 1, opposite: 4, x: 0, y: -1, endX: 24, endY: 0 },
  { bit: 2, opposite: 8, x: 1, y: 0, endX: 48, endY: 24 },
  { bit: 4, opposite: 1, x: 0, y: 1, endX: 24, endY: 48 },
  { bit: 8, opposite: 2, x: -1, y: 0, endX: 0, endY: 24 },
]

function turn(mask: number) {
  return ((mask << 1) | (mask >> 3)) & 15
}

const startingCircuit = [6, 10, 12, 9, 14, 3, 5, 11, 9].map((mask, index) =>
  [0, 2, 3, 7].includes(index) ? turn(mask) : index === 5 ? turn(turn(mask)) : mask)

function connectedTiles(tiles: number[]) {
  const powered = new Set<number>()
  if (!((tiles[3] ?? 0) & 8)) return powered

  powered.add(3)
  for (const index of powered) {
    const mask = tiles[index] ?? 0
    const x = index % 3
    const y = Math.floor(index / 3)
    for (const direction of directions) {
      const nextX = x + direction.x
      const nextY = y + direction.y
      if (!(mask & direction.bit) || nextX < 0 || nextX >= 3 || nextY < 0 || nextY >= 3) continue
      const next = nextY * 3 + nextX
      if ((tiles[next] ?? 0) & direction.opposite) powered.add(next)
    }
  }
  return powered
}

function CircuitPuzzle({ play, onSuccess }: PuzzleProps) {
  const [tiles, setTiles] = useState(startingCircuit)
  const powered = connectedTiles(tiles)

  function rotate(index: number) {
    const next = tiles.map((tile, position) => position === index ? turn(tile) : tile)
    play("officeRotate")
    setTiles(next)
    if (connectedTiles(next).has(5) && ((next[5] ?? 0) & 2)) onSuccess()
  }

  return (
    <div className="rt-circuit">
      <span className="rt-circuit-port">Вход</span>
      <div className="rt-node-grid">
        {tiles.map((mask, index) => (
          <button className="rt-node" type="button" data-lit={powered.has(index)} key={index}
            aria-label={`Повернуть узел ${index + 1}`} onClick={() => rotate(index)}>
            <svg viewBox="0 0 48 48" aria-hidden="true">
              {directions.filter(direction => mask & direction.bit).map(direction => (
                <line x1={24} y1={24} x2={direction.endX} y2={direction.endY} key={direction.bit} />
              ))}
              <circle cx={24} cy={24} r={5} />
            </svg>
          </button>
        ))}
      </div>
      <span className="rt-circuit-port">Доступ</span>
    </div>
  )
}

const sequences = [[0, 4, 2, 7], [6, 1, 8, 3, 5]] as const
const notes = [
  "officeNote1", "officeNote2", "officeNote3",
  "officeNote4", "officeNote2", "officeNote5",
  "officeNote1", "officeNote4", "officeNote3",
] as const
const tiles = Array.from({ length: 9 }, (_, index) => index)

function MemoryPuzzle({ play, onFailure, onSuccess }: PuzzleProps) {
  const [round, setRound] = useState<0 | 1>(0)
  const [replay, setReplay] = useState(0)
  const [progress, setProgress] = useState(0)
  const [lit, setLit] = useState(-1)
  const [showing, setShowing] = useState(true)
  const [miss, setMiss] = useState(false)
  const feedback = useRef<number | undefined>(undefined)
  const sequence = sequences[round]

  useEffect(() => {
    const leadIn = replay > 0 ? 560 : 340
    const timers = sequence.flatMap((tile, step) => [
      window.setTimeout(() => {
        setMiss(false)
        setLit(tile)
        play(notes[tile])
      }, leadIn + step * 450),
      window.setTimeout(() => setLit(-1), leadIn + step * 450 + 345),
    ])
    timers.push(window.setTimeout(() => setShowing(false), leadIn + sequence.length * 450))
    return () => timers.forEach(timer => window.clearTimeout(timer))
  }, [play, replay, sequence])

  useEffect(() => () => window.clearTimeout(feedback.current), [])

  function enter(tile: number) {
    if (showing) return
    window.clearTimeout(feedback.current)
    if (tile !== sequence[progress]) {
      onFailure()
      setLit(-1)
      setMiss(true)
      setShowing(true)
      setProgress(0)
      setReplay(replay + 1)
      return
    }
    play(notes[tile] ?? notes[0])
    if (progress + 1 === sequence.length) {
      if (round === 1) onSuccess()
      else {
        setRound(1)
        setProgress(0)
        setReplay(0)
        setShowing(true)
        setLit(-1)
      }
      return
    }
    setLit(tile)
    setProgress(progress + 1)
    feedback.current = window.setTimeout(() => setLit(-1), 180)
  }

  useEffect(() => {
    function handleDigit(event: globalThis.KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || !/^[1-9]$/.test(event.key)) return
      event.preventDefault()
      enter(Number(event.key) - 1)
    }
    window.addEventListener("keydown", handleDigit)
    return () => window.removeEventListener("keydown", handleDigit)
  }, [sequence, progress, showing, replay, play, onFailure, onSuccess, round])

  return (
    <div className="rt-memory" data-miss={miss}>
      <p className="rt-puzzle-status" role="status">
        {miss ? "Неверная клавиша · тревога +25%" : `Раунд ${round + 1}/2 · ${showing ? "Запоминай" : `Повтори ${progress}/${sequence.length}`}`}
      </p>
      <div className="rt-node-grid">
        {tiles.map(index => (
          <button className="rt-node" type="button" aria-disabled={showing} data-lit={lit === index} key={index}
            aria-label={`Клавиша ${index + 1}`} onClick={() => enter(index)}>
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function HackPuzzleModal({ kind, label, alert, onCancel, ...props }: PuzzleProps & {
  kind: PuzzleKind
  label: string
  alert: number
  onCancel: () => void
}) {
  const dialog = useRef<HTMLElement>(null)
  useEffect(() => { dialog.current?.focus({ preventScroll: true }) }, [])

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      onCancel()
    }
    if (event.key === "Tab") {
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")
      const first = buttons?.[0]
      const last = buttons?.[buttons.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }

  let puzzle: ReactNode
  switch (kind) {
    case "frequency": puzzle = <FrequencyPuzzle {...props} />; break
    case "circuit": puzzle = <CircuitPuzzle {...props} />; break
    case "memory": puzzle = <MemoryPuzzle {...props} />; break
  }

  return (
    <div className="rt-overlay rt-hack-overlay">
      <section className="rt-dialog rt-hack" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true"
        aria-labelledby="rt-hack-title" aria-describedby="rt-hack-rule" onKeyDown={handleKey}>
        <header className="rt-hack-header">
          <span className="rt-dialog-label"><Terminal size={15} aria-hidden="true" /> {label}</span>
          <button className="rt-button rt-puzzle-cancel" type="button" onClick={onCancel}>Отмена <kbd>Esc</kbd></button>
        </header>
        <h2 id="rt-hack-title">{puzzles[kind].title}</h2>
        <p id="rt-hack-rule">{puzzles[kind].rule}</p>
        {puzzle}
        <div className="rt-hack-alert" data-danger={alert > 0}>Тревога <strong>{alert}%</strong></div>
      </section>
    </div>
  )
}
