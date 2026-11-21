import { ArrowLeft, Crosshair, MessageCircle, RotateCcw, ScanLine, Terminal, Volume2, VolumeX, Zap } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { PointerEvent } from "react"
import type { createSfx } from "../audio/sfx"
import { readSoundPreference, saveSoundPreference } from "../game/feedback"
import AgentPhone, { messageCount } from "./AgentPhone"
import HackPuzzleModal from "./HackPuzzleModal"
import { findings } from "./mapData"
import type { Point } from "./mapData"
import { createRenderer } from "./render"
import { closeHack, createRun, empCharges, failHack, finishHack, fireEmp, openHack, stepRun } from "./simulation"
import type { Phase, Run } from "./simulation"
import "./redteam.css"

const movement = new Map([
  ["KeyW", { x: 0, y: -1 }], ["ArrowUp", { x: 0, y: -1 }],
  ["KeyS", { x: 0, y: 1 }], ["ArrowDown", { x: 0, y: 1 }],
  ["KeyA", { x: -1, y: 0 }], ["ArrowLeft", { x: -1, y: 0 }],
  ["KeyD", { x: 1, y: 0 }], ["ArrowRight", { x: 1, y: 0 }],
])
const neutral = { x: 0, y: 0 }

function snapshot(run: Run) {
  return {
    phase: run.phase, time: Math.floor(run.time), charges: run.charges, alert: Math.round(run.alert * 100),
    exposed: run.exposed, alerts: run.alerts, count: run.scanned.length, focus: run.focus,
    toast: run.toast && run.clock < run.toast.until ? run.toast.index : -1,
    events: run.events,
  }
}

function formatTime(time: number) {
  return [Math.floor(time / 60), time % 60].map(value => String(value).padStart(2, "0")).join(":")
}

export default function RedTeamGame({ audio }: { audio: ReturnType<typeof createSfx> }) {
  const run = useRef<Run | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const mapAction = useRef<HTMLButtonElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const keys = useRef(new Set<string>())
  const stick = useRef({ id: -1, vector: neutral })
  const movementInput = useRef<Point>({ ...neutral })
  const phoneActive = useRef(false)
  const announced = useRef(1)
  const [hud, setHud] = useState(() => snapshot(createRun()))
  const [sound, setSound] = useState(readSoundPreference)
  const [knob, setKnob] = useState(neutral)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [seen, setSeen] = useState(0)

  function clearInputs() {
    keys.current.clear()
    stick.current = { id: -1, vector: neutral }
    setKnob(neutral)
  }

  function begin() {
    clearInputs()
    run.current = createRun("playing")
    setSeen(0)
    announced.current = 1
    audio.play("officeMessage")
    setHud(snapshot(run.current))
  }

  function enterHack() {
    const current = run.current
    if (!current || phoneActive.current) return
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

  function handleHackFailure() {
    if (!run.current) return
    failHack(run.current, audio.play)
    setHud(snapshot(run.current))
  }

  function handleHackSuccess() {
    if (!run.current) return
    finishHack(run.current, audio.play)
    setHud(snapshot(run.current))
  }

  const closePhone = useCallback(() => {
    phoneActive.current = false
    setPhoneOpen(false)
  }, [])

  function openPhone() {
    clearInputs()
    phoneActive.current = true
    setSeen(messageCount(hud.events))
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

  useEffect(() => {
    if (hud.phase === "playing") canvas.current?.focus({ preventScroll: true })
    else if (hud.phase !== "hacking") primary.current?.focus({ preventScroll: true })
  }, [hud.phase])

  useEffect(() => {
    if (hud.events.length > announced.current) audio.play("officeMessage")
    announced.current = hud.events.length
  }, [audio, hud.events])

  useEffect(() => {
    const element = canvas.current
    const ctx = element?.getContext("2d", { alpha: false })
    if (!element || !ctx) return

    run.current = createRun()
    audio.setEnabled(readSoundPreference())
    const paint = createRenderer(ctx)
    const touchControls = window.matchMedia("(pointer: coarse), (max-width: 619px)")
    let displayWidth = 1
    let frame = 0
    let previous = 0
    let lastHud = 0
    let lastPhase: Phase = "briefing"
    let lastDpr = 0

    function resize() {
      const node = canvas.current
      if (!node) return
      const bounds = node.getBoundingClientRect()
      lastDpr = window.devicePixelRatio || 1
      displayWidth = Math.max(1, bounds.width)
      node.width = Math.max(1, Math.round(bounds.width * lastDpr))
      node.height = Math.max(1, Math.round(bounds.height * lastDpr))
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
      if (!phoneActive.current) stepRun(current, dt, vector, audio.play)
      if (current.phase !== lastPhase || ((current.phase === "playing" || current.phase === "hacking") && now - lastHud >= 65)) {
        if (current.phase !== "playing") clearInputs()
        setHud(snapshot(current))
        lastPhase = current.phase
        lastHud = now
      }
      const target = paint(current, displayWidth, touchControls.matches)
      if (target && mapAction.current) {
        mapAction.current.style.left = `${target.x * 100}%`
        mapAction.current.style.top = `${target.y * 100}%`
      }
      frame = requestAnimationFrame(animate)
    }

    function onKeyDown(event: KeyboardEvent) {
      const current = run.current
      if (!current || phoneActive.current || current.phase === "hacking" || event.altKey || event.ctrlKey || event.metaKey) return
      if (movement.has(event.code)) {
        if (!["briefing", "playing"].includes(current.phase)) return
        event.preventDefault()
        if (current.phase === "briefing") begin()
        keys.current.add(event.code)
      } else if (event.code === "KeyR" && current.phase !== "briefing") {
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

    const observer = new ResizeObserver(resize)
    observer.observe(element)
    resize()
    frame = requestAnimationFrame(animate)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", clearInputs)
    document.addEventListener("visibilitychange", clearInputs)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", clearInputs)
      document.removeEventListener("visibilitychange", clearInputs)
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
  const toast = findings[hud.toast]
  const unread = messageCount(hud.events) - seen
  const rank = hud.alerts === 0 && hud.time <= 65 ? "S" : hud.alerts <= 2 && hud.time <= 110 ? "A" : "B"
  const SoundIcon = sound ? Volume2 : VolumeX

  return (
    <main className="rt-page">
      <div className="rt-shell">
        <header className="rt-header" inert={hacking}>
          <div className="rt-brand">
            <Terminal size={20} aria-hidden="true" />
            <span>Work<span>Lab</span></span>
          </div>
          <div className="rt-mission">
            <span>Red Team · Белый хакер</span>
            <h1>Проникновение в офис</h1>
          </div>
          <a className="rt-button rt-back" href="#game"><ArrowLeft size={16} aria-hidden="true" /> Миссии</a>
        </header>

        <div className="rt-hud" aria-label="Панель операции" inert={hacking}>
          <div className="rt-count"><Crosshair size={17} aria-hidden="true" /><span>Уязвимости</span> <strong>{hud.count}/{findings.length}</strong></div>
          <div className="rt-alert" data-exposed={hud.exposed}>
            <div><span>Обнаружение</span><strong>{hud.alert}%</strong></div>
            <progress max={100} value={hud.alert} aria-label="Обнаружение" />
          </div>
          <time className="rt-time" aria-label="Время забега">{formatTime(hud.time)}</time>
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
            {playing && target && <button className="rt-map-action" ref={mapAction} type="button" onClick={enterHack}>
              <kbd>E</kbd> Взломать
            </button>}
          </div>
          {playing && toast && (
            <div className="rt-toast" role="status">
              <ScanLine size={20} aria-hidden="true" />
              <div><strong>{toast.label}</strong><p>{toast.detail}{hud.count === findings.length && " Шлюз в серверную открыт."}</p></div>
            </div>
          )}
          {hacking && target && (
            <HackPuzzleModal kind={target.puzzle} label={target.short} alert={hud.alert} play={audio.play}
              onCancel={leaveHack} onSuccess={handleHackSuccess} onFailure={handleHackFailure} />
          )}
          {!playing && !hacking && (
            <div className="rt-overlay" data-phase={hud.phase}>
              <section className="rt-dialog" role="dialog" aria-labelledby="rt-dialog-title">
                {briefing ? (
                  <>
                    <div className="rt-dialog-label"><Crosshair size={16} aria-hidden="true" /> Задание</div>
                    <h2 id="rt-dialog-title">Проверь офис банка</h2>
                    <p>Реши три головоломки, обойди охрану и доберись до ядра банка.</p>
                    <p className="rt-desktop-help"><kbd>WASD</kbd> — движение, <kbd>E</kbd> — взлом, <kbd>Пробел</kbd> — EMP.</p>
                    <p className="rt-touch-help">Двигайся джойстиком. Кнопка EMP отключает охрану поблизости.</p>
                    <button className="rt-button rt-primary" ref={primary} type="button" onClick={begin}>Начать операцию</button>
                  </>
                ) : completed ? (
                  <>
                    <h2 id="rt-dialog-title">Операция завершена · Red Team</h2>
                    <dl className="rt-stats">
                      <div><dt>Ранг</dt><dd className="rt-rank">{rank}</dd></div>
                      <div><dt>Время</dt><dd>{formatTime(hud.time)}</dd></div>
                      <div><dt>Тревог</dt><dd>{hud.alerts}</dd></div>
                      <div><dt>Использовано EMP</dt><dd>{empCharges - hud.charges}</dd></div>
                    </dl>
                    <ol className="rt-report">
                      {findings.map(finding => (
                        <li key={finding.label}><strong>{finding.label}</strong><p>{finding.advice}</p></li>
                      ))}
                    </ol>
                    <div className="rt-dialog-actions">
                      <button className="rt-button rt-primary" ref={primary} type="button" onClick={begin}>Пройти заново</button>
                      <a className="rt-button" href="#game">К выбору миссий</a>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rt-dialog-label"><Crosshair size={16} aria-hidden="true" /> Тревога</div>
                    <h2 id="rt-dialog-title">Агент обнаружен</h2>
                    <p>Используй стены как укрытия или отключай охрану с помощью EMP.</p>
                    <button className="rt-button rt-primary" ref={primary} type="button" onClick={begin}>Начать заново <kbd>R</kbd></button>
                  </>
                )}
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
                <ScanLine size={16} aria-hidden="true" /> Взломать
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
          <div className="rt-phone-slot" inert={hacking}><AgentPhone events={hud.events} open={phoneOpen} onClose={closePhone} /></div>
        </div>
      </div>
    </main>
  )
}
