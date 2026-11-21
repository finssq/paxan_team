import { cameras, core, drones, findings, gate, mapSize, objectiveOrder, sealedWalls, spawn, walls } from "./mapData"
import type { Point, PuzzleKind, Rect } from "./mapData"

export type Phase = "briefing" | "playing" | "hacking" | "caught" | "complete"
export type OfficeEvent = "briefing" | "camera" | "gate" | "victory" | PuzzleKind
type Effect = "officeScan" | "officeEmp" | "officeGate" | "officeAlert" | "officeWin" | "officeHackError"
type PlayEffect = (effect: Effect) => void

export const agentRadius = 10
export const scanRadius = 28
export const empRadius = 220
export const empDuration = 4.5
export const empCharges = 2
export const fullTurn = 2 * Math.PI

export type Threat = Point & {
  angle: number
  range: number
  halfAngle: number
  disabledUntil: number
}

type Burst = Point & { at: number; count: number }

export type Run = {
  phase: Phase
  time: number
  clock: number
  agent: Point & { angle: number }
  charges: number
  alert: number
  alerts: number
  exposed: boolean
  lastTick: number
  moved: boolean
  scanned: number[]
  focus: number
  events: OfficeEvent[]
  threats: Threat[]
  wave?: Point & { at: number }
  toast?: { index: number; until: number }
  bursts: Burst[]
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function distance(from: Point, to: Point) {
  return Math.hypot(to.x - from.x, to.y - from.y)
}

function moveThreats(run: Run) {
  cameras.forEach((camera, index) => {
    const threat = run.threats[index]!
    threat.angle = camera.angle + Math.sin(run.clock * camera.speed + camera.phase) * camera.swing
  })

  drones.forEach((drone, index) => {
    const patrol = run.threats[cameras.length + index]!
    const progress = (run.clock / drone.period * drone.route.length + index * 1.6) % drone.route.length
    const step = Math.floor(progress)
    const t = progress - step
    const p0 = drone.route[(step + drone.route.length - 1) % drone.route.length]!
    const p1 = drone.route[step]!
    const p2 = drone.route[(step + 1) % drone.route.length]!
    const p3 = drone.route[(step + 2) % drone.route.length]!
    const spline = (key: keyof Point) => {
      const a = p0[key], b = p1[key], c = p2[key], d = p3[key]
      const quadratic = 2 * a - 5 * b + 4 * c - d
      const cubic = -a + 3 * b - 3 * c + d
      return b + .5 * t * (c - a + t * (quadratic + t * cubic))
    }
    const x = spline("x")
    const y = spline("y")
    if (x !== patrol.x || y !== patrol.y) patrol.angle = Math.atan2(y - patrol.y, x - patrol.x)
    patrol.x = x
    patrol.y = y
  })
}

export function createRun(phase: Phase = "briefing"): Run {
  const run: Run = {
    phase, time: 0, clock: 0, agent: { ...spawn, angle: 0 }, charges: empCharges,
    alert: 0, alerts: 0, exposed: false, lastTick: -1, moved: false, scanned: [], focus: -1, events: ["briefing"], bursts: [],
    threats: [
      ...cameras.map(camera => ({ ...camera, disabledUntil: 0 })),
      ...drones.map(drone => ({ ...drone.route[0], angle: 0, range: drone.range, halfAngle: Math.PI, disabledUntil: 0 })),
    ],
  }
  moveThreats(run)
  return run
}

export function activeWalls(run: Run) {
  return run.scanned.length === findings.length ? walls : sealedWalls
}

export function nextObjective(events: readonly OfficeEvent[]) {
  return objectiveOrder.find(puzzle => !events.includes(puzzle))
}

export function openHack(run: Run) {
  if (run.phase === "playing" && run.focus >= 0) run.phase = "hacking"
}

export function closeHack(run: Run) {
  if (run.phase === "hacking") run.phase = "playing"
}

export function failHack(run: Run, play: PlayEffect) {
  if (run.phase !== "hacking") return
  if (run.alert === 0) run.alerts += 1
  run.alert = Math.min(1, run.alert + .25)
  play("officeHackError")
  if (run.alert === 1) run.phase = "caught"
}

export function finishHack(run: Run, play: PlayEffect) {
  const finding = findings[run.focus]
  if (run.phase !== "hacking" || !finding) return

  run.scanned.push(run.focus)
  run.events = [...run.events, finding.puzzle]
  run.toast = { index: run.focus, until: run.clock + 3.5 }
  run.bursts.push({ x: finding.x, y: finding.y, at: run.clock, count: 18 })
  run.focus = -1
  run.phase = "playing"
  play("officeScan")
  if (run.scanned.length === findings.length) {
    run.events = [...run.events, "gate"]
    run.bursts.push({ x: gate.x + gate.w / 2, y: gate.y + gate.h / 2, at: run.clock, count: 25 })
    play("officeGate")
  }
}

export function rayDistance(x: number, y: number, dx: number, dy: number, range: number, obstacles: Rect[]) {
  const inverseX = 1 / dx
  const inverseY = 1 / dy
  let nearest = range

  for (const wall of obstacles) {
    if ((dx === 0 && (x <= wall.x || x >= wall.x + wall.w)) ||
        (dy === 0 && (y <= wall.y || y >= wall.y + wall.h))) continue

    const left = dx === 0 ? -Infinity : (wall.x - x) * inverseX
    const right = dx === 0 ? Infinity : (wall.x + wall.w - x) * inverseX
    const top = dy === 0 ? -Infinity : (wall.y - y) * inverseY
    const bottom = dy === 0 ? Infinity : (wall.y + wall.h - y) * inverseY
    const near = Math.max(Math.min(left, right), Math.min(top, bottom), 0)
    const far = Math.min(Math.max(left, right), Math.max(top, bottom))
    if (far >= near && near < nearest) nearest = near
  }
  return nearest
}

function canStand(x: number, y: number, obstacles: Rect[]) {
  return x >= agentRadius + 16 && x <= mapSize.width - agentRadius - 16 &&
    y >= agentRadius + 16 && y <= mapSize.height - agentRadius - 16 &&
    !obstacles.some(wall => {
      const dx = x - clamp(x, wall.x, wall.x + wall.w)
      const dy = y - clamp(y, wall.y, wall.y + wall.h)
      return dx * dx + dy * dy < agentRadius * agentRadius
    })
}

function seesAgent(threat: Threat, agent: Point, obstacles: Rect[]) {
  const dx = agent.x - threat.x
  const dy = agent.y - threat.y
  const gap = Math.hypot(dx, dy)
  if (gap >= threat.range) return false
  if (gap < .01) return true
  if (threat.halfAngle < Math.PI && (dx * Math.cos(threat.angle) + dy * Math.sin(threat.angle)) / gap < Math.cos(threat.halfAngle)) return false
  return rayDistance(threat.x, threat.y, dx / gap, dy / gap, gap, obstacles) >= gap
}

export function fireEmp(run: Run, play: PlayEffect) {
  if (run.phase !== "playing" || run.charges === 0 || (run.wave && run.clock - run.wave.at < .55)) return

  run.charges -= 1
  run.wave = { x: run.agent.x, y: run.agent.y, at: run.clock }
  for (const threat of run.threats) {
    if (distance(run.wave, threat) > empRadius) continue
    threat.disabledUntil = run.clock + empDuration
    run.bursts.push({ x: threat.x, y: threat.y, at: run.clock, count: 8 })
  }
  play("officeEmp")
}

export function stepRun(run: Run, dt: number, motion: Point, play: PlayEffect) {
  if (run.phase === "hacking") {
    run.time += dt
    return
  }
  if (run.phase !== "briefing" && run.phase !== "playing") return

  run.clock += dt
  moveThreats(run)
  if (run.phase !== "playing") return

  run.time += dt
  const obstacles = activeWalls(run)
  const magnitude = Math.hypot(motion.x, motion.y)
  if (magnitude > .05) {
    const distance = 145 * dt / Math.max(1, magnitude)
    const x = run.agent.x + motion.x * distance
    const y = run.agent.y + motion.y * distance
    if (x !== run.agent.x && canStand(x, run.agent.y, obstacles)) {
      run.agent.x = x
      run.moved = true
    }
    if (y !== run.agent.y && canStand(run.agent.x, y, obstacles)) {
      run.agent.y = y
      run.moved = true
    }
    run.agent.angle = Math.atan2(motion.y, motion.x)
  }

  const detector = run.threats.findIndex(threat => threat.disabledUntil <= run.clock && seesAgent(threat, run.agent, obstacles))
  run.exposed = detector >= 0
  if (run.exposed) {
    if (detector < cameras.length && !run.events.includes("camera")) run.events = [...run.events, "camera"]
    if (run.alert === 0) run.alerts += 1
    run.alert = Math.min(1, run.alert + dt / .85)
    if (run.clock - run.lastTick >= (run.alert > .55 ? .19 : .32)) {
      run.lastTick = run.clock
      play("officeAlert")
    }
    if (run.alert === 1) {
      run.phase = "caught"
      return
    }
  } else {
    run.alert = Math.max(0, run.alert - dt * .82)
  }

  run.focus = findings.findIndex((finding, index) =>
    !run.scanned.includes(index) && distance(finding, run.agent) <= scanRadius)
  if (run.scanned.length === findings.length && distance(core, run.agent) < 23) {
    run.phase = "complete"
    run.events = [...run.events, "victory"]
    play("officeWin")
  }
  if (run.bursts.length) run.bursts = run.bursts.filter(burst => run.clock - burst.at < .85)
}
