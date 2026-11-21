import { CircleAlert, Package, Server, ShieldCheck, Snowflake, WalletCards } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { friday } from "../data/friday"
import type { Packet } from "../data/friday"

type FlightPhase = "ready" | "flying" | "frozen" | "finishing" | "arrived"

export function TrafficIntercept({ packets, paused, onCatch, onArrive, onEvidence }: {
  packets: Packet[]; paused: boolean; onCatch: (packet: Packet) => void; onArrive: () => void; onEvidence: () => void
}) {
  const copy = friday.traffic
  const reducedMotion = useReducedMotion()
  const [phase, setPhase] = useState<FlightPhase>("ready")
  const [channelIndex, setChannelIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const cursor = useRef(0)
  const arrival = useRef(onArrive)
  const activeChannel = useRef<HTMLDivElement>(null)
  const keyboardFlight = useRef(false)
  const inspector = useRef<HTMLElement>(null)
  const inFlight = phase === "flying" || phase === "finishing"

  useEffect(() => { arrival.current = onArrive }, [onArrive])

  useEffect(() => {
    if (!inFlight || paused) return
    const started = performance.now() - cursor.current
    let frame: number
    function move(now: number) {
      cursor.current = Math.max(0, Math.min(friday.flightMs, now - started))
      if (cursor.current < friday.flightMs) {
        setElapsed(cursor.current)
        frame = window.requestAnimationFrame(move)
      } else if (channelIndex + 1 < packets.length) {
        cursor.current = 0
        setElapsed(0)
        setChannelIndex(channelIndex + 1)
        setPhase("flying")
      } else {
        setPhase("arrived")
        arrival.current()
      }
    }
    frame = window.requestAnimationFrame(move)
    return () => window.cancelAnimationFrame(frame)
  }, [inFlight, paused, channelIndex, packets.length])

  useEffect(() => {
    if (phase !== "flying" || paused) return
    const channel = activeChannel.current
    if (!channel?.getClientRects().length) return
    if (channelIndex > 0 && channel.closest('[data-active="true"]')) channel.scrollIntoView({ block: "nearest" })
    if (keyboardFlight.current) channel.querySelector<HTMLButtonElement>(".traffic-freeze")?.focus({ preventScroll: true })
  }, [channelIndex, phase, paused])

  useEffect(() => {
    if (phase !== "frozen" || !inspector.current) return
    inspector.current.focus({ preventScroll: true })
  }, [phase])

  function send(keyboard: boolean) {
    cursor.current = 0
    setElapsed(0)
    setChannelIndex(0)
    keyboardFlight.current = keyboard
    setPhase("flying")
  }

  function freeze(packet: Packet) {
    if (phase !== "flying" || paused || packet.id !== packets[channelIndex]?.id || cursor.current >= friday.flightMs) return
    setPhase("frozen")
    onCatch(packet)
  }

  function release() {
    setPhase("finishing")
  }

  return (
    <section className="traffic-panel" data-flight={phase} aria-label={copy.title}>
      <header className="traffic-heading">
        <h3>{copy.title}</h3>
        <button className="os-primary os-training-action" type="button" disabled={paused || phase === "frozen" || inFlight} onClick={event => send(event.detail === 0)}>
          <WalletCards size={17} aria-hidden="true" /> {inFlight ? copy.sending : copy.send}
        </button>
      </header>
      {packets.map((packet, index) => {
        const active = index === channelIndex
        const held = active && phase === "frozen"
        const moving = active && (inFlight || held)
        const position = reducedMotion ? 50 : elapsed / friday.flightMs * 100
        return (
          <div key={packet.id} className="traffic-channel" ref={active ? activeChannel : undefined} data-frozen={held || undefined}>
            <span className="traffic-channel-label">{packet.channel}</span>
            <div className="traffic-cable">
              <svg viewBox="0 0 240 10" preserveAspectRatio="none" aria-hidden="true"><path d="M0 5H240" /><path d="M0 5H240" /></svg>
              {moving && <button type="button" className="traffic-capsule" data-frozen={held || undefined} style={{ left: `${position}%` }}
                aria-label={`${copy.freeze} · ${packet.channel}`} disabled={phase !== "flying" || paused} onClick={() => freeze(packet)}>
                <Package size={17} aria-hidden="true" />
                {held && <span>{copy.caught}</span>}
              </button>}
            </div>
            <span className="traffic-server" data-arrived={phase === "arrived" || index < channelIndex || undefined} aria-label="Сервер"><Server size={18} aria-hidden="true" /><i /></span>
            {moving && <button type="button" className="os-secondary traffic-freeze" disabled={paused || phase !== "flying"} onClick={() => freeze(packet)}>
              <Snowflake size={15} aria-hidden="true" /> {copy.freeze} <span>· {packet.channel}</span>
            </button>}
            {held && <motion.section className="traffic-inspector" tabIndex={-1} ref={inspector} aria-label={copy.inspector}
              initial={reducedMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .17 }}>
              <header><h3>{copy.inspector}</h3><strong data-warning={packet.unsafe || undefined}>{packet.unsafe ? copy.danger : copy.safe}</strong></header>
              <div className="traffic-route"><span>{packet.route}</span><code>{packet.request}</code></div>
              <dl>{packet.fields.map(field => <div key={field.key} data-warning={field.warning || undefined}>
                <dt>{field.warning && <CircleAlert size={15} aria-hidden="true" />}{field.key}</dt><dd>{field.value}</dd>
              </div>)}</dl>
              <p data-warning={packet.unsafe || undefined}>{packet.unsafe ? <CircleAlert size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}{packet.explanation}</p>
              <footer>
                {packet.unsafe && <button type="button" className="os-secondary" onClick={onEvidence}>{copy.evidence}</button>}
                <button type="button" className="os-secondary" onClick={release}>{copy.release}</button>
              </footer>
            </motion.section>}
          </div>
        )
      })}
      {phase === "flying" && <p className="traffic-instruction" role="status">{copy.instruction}</p>}
      {phase === "arrived" && <p className="traffic-instruction" role="status">{copy.arrived}</p>}
    </section>
  )
}
