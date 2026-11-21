import { cableRuns, cameras, core, desks, findings, gate, gateApproach, mapSize, racks, rooms, walls } from "./mapData"
import type { Point, Rect } from "./mapData"
import { createAgentDrawing, paintCore, paintDesk, paintFindingObject, paintGateHardware, paintPickups, paintPlants, paintRackLights, paintSurveillance } from "./canvasDraw"
import { activeWalls, clamp, empDuration, empRadius, fullTurn, nextObjective, rayDistance, scanRadius } from "./simulation"
import type { Run, Threat } from "./simulation"

const lime = "#8EE872"
const mint = "#A7F3D0"
const floorColor = "#0b120e"
const mono = "ui-monospace, Consolas, monospace"

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, fullTurn)
}

function trace(ctx: CanvasRenderingContext2D, [first, ...remaining]: [Point, ...Point[]]) {
  ctx.beginPath()
  ctx.moveTo(first.x, first.y)
  for (const point of remaining) ctx.lineTo(point.x, point.y)
  ctx.stroke()
}

function makeFloor() {
  const floor = document.createElement("canvas")
  floor.width = mapSize.width * 2
  floor.height = mapSize.height * 2
  const ctx = floor.getContext("2d")
  if (!ctx) return floor

  ctx.scale(2, 2)
  ctx.fillStyle = "#070b09"
  ctx.fillRect(0, 0, mapSize.width, mapSize.height)
  const light = ctx.createRadialGradient(510, 265, 0, 510, 265, 535)
  light.addColorStop(0, "#14281c")
  light.addColorStop(1, floorColor)
  ctx.fillStyle = light
  ctx.fillRect(16, 16, 928, 508)

  ctx.strokeStyle = "#82ad9615"
  ctx.beginPath()
  for (let x = 40; x < 930; x += 20) {
    ctx.moveTo(x, 25)
    ctx.lineTo(x, 515)
  }
  for (let y = 40; y < 510; y += 20) {
    ctx.moveTo(25, y)
    ctx.lineTo(935, y)
  }
  ctx.stroke()

  ctx.strokeStyle = "#263a2d"
  ctx.setLineDash([3, 5])
  for (const cable of cableRuns) trace(ctx, cable)
  ctx.setLineDash([])

  ctx.fillStyle = "#121a15"
  ctx.strokeStyle = "#263a2d"
  for (const desk of desks) paintDesk(ctx, desk)
  paintPlants(ctx)
  ctx.fillStyle = "#121a15"
  ctx.strokeStyle = "#263a2d"
  for (const { x, y, w, h } of racks) {
    ctx.fillRect(x, y, w, h)
    ctx.strokeRect(x, y, w, h)
    for (let slot = y + 8; slot < y + h - 4; slot += 9) ctx.strokeRect(x + 4, slot, w - 8, 4)
  }

  ctx.font = `bold 15px ${mono}`
  ctx.fillStyle = "#85a48e"
  for (const room of rooms) ctx.fillText(room.name, room.x, room.y)
  return floor
}

function paintThreat(ctx: CanvasRenderingContext2D, threat: Threat, drone: boolean, clock: number, obstacles: Rect[]) {
  const { x, y, angle, halfAngle, range, disabledUntil } = threat
  const disabled = disabledUntil > clock
  if (!disabled) {
    const start = angle - halfAngle
    const increment = 2 * halfAngle / 40
    ctx.beginPath()
    if (!drone) ctx.moveTo(x, y)
    for (let step = 0; step <= 40; step += 1) {
      const dx = Math.cos(start + increment * step)
      const dy = Math.sin(start + increment * step)
      const length = rayDistance(x, y, dx, dy, range, obstacles)
      if (step === 0 && drone) ctx.moveTo(x + dx * length, y + dy * length)
      else ctx.lineTo(x + dx * length, y + dy * length)
    }
    ctx.closePath()
    const light = ctx.createRadialGradient(x, y, 0, x, y, range)
    light.addColorStop(0, drone ? "#EF444446" : "#EF444472")
    light.addColorStop(.52, "#EF444435")
    light.addColorStop(1, "#EF444413")
    ctx.fillStyle = light
    ctx.strokeStyle = "#ef444460"
    ctx.lineWidth = 1
    ctx.fill()
    ctx.stroke()
    if (drone) {
      ctx.save()
      ctx.clip()
      const pulse = (clock * .75 + x * .01) % 1
      circle(ctx, x, y, range * pulse)
      ctx.globalAlpha = .65 * (1 - pulse)
      ctx.strokeStyle = "#FF847D"
      ctx.stroke()
      ctx.restore()
    }

    const beam = drone ? clock * 2 : angle + Math.sin(clock * 4) * halfAngle * .86
    const dx = Math.cos(beam)
    const dy = Math.sin(beam)
    const length = rayDistance(x, y, dx, dy, range, obstacles)
    ctx.strokeStyle = "#fa7979ac"
    trace(ctx, [{ x, y }, { x: x + dx * length, y: y + dy * length }])
  }
}

function paintDevice(ctx: CanvasRenderingContext2D, threat: Threat, drone: boolean, clock: number) {
  const { x, y, disabledUntil } = threat
  const remaining = disabledUntil - clock
  paintSurveillance(ctx, threat, drone, clock)
  if (remaining <= 0) return

  ctx.strokeStyle = mint
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x, y, 13, -Math.PI / 2, -Math.PI / 2 + remaining / empDuration * fullTurn)
  ctx.stroke()
  ctx.fillStyle = mint
  ctx.textAlign = "center"
  ctx.font = `bold 12px ${mono}`
  ctx.fillText(`${remaining.toFixed(1)} с`, x, y - 17)
}

function paintFinding(ctx: CanvasRenderingContext2D, run: Run, { x, y, short, puzzle }: (typeof findings)[number], index: number) {
  const found = run.scanned.includes(index)
  const active = run.focus === index
  const next = puzzle === nextObjective(run.events)
  const pulse = Math.sin(run.clock * 3)
  ctx.lineWidth = 1.5
  if (!found) {
    circle(ctx, x, y, scanRadius + pulse * 2)
    ctx.strokeStyle = active || next ? "#8ee872a8" : "#8ee87259"
    ctx.fillStyle = "#8ee8720b"
    ctx.fill()
    ctx.stroke()
    if (next) {
      circle(ctx, x, y, scanRadius + 7 + pulse * 4)
      ctx.strokeStyle = "#8ee87255"
      ctx.stroke()
    }
  }

  paintFindingObject(ctx, { x, y }, puzzle, found, run.clock)
  ctx.textAlign = "center"
  ctx.fillStyle = found ? "#94b799" : "#d9eadb"
  ctx.font = `bold 12px ${mono}`
  ctx.fillText(short, x, y + 45)

}

function paintGate(ctx: CanvasRenderingContext2D, run: Run, unlocked: boolean) {
  const x = gate.x + gate.w / 2
  const y = gate.y + gate.h / 2
  paintGateHardware(ctx, gate, unlocked, run.clock)
  ctx.fillStyle = unlocked ? lime : "#fca5a5"
  ctx.textAlign = "right"
  ctx.font = `bold 11px ${mono}`
  ctx.fillText(unlocked ? "ШЛЮЗ ОТКРЫТ" : "ШЛЮЗ ЗАКРЫТ", x - 10, y - 19)

  paintCore(ctx, core, unlocked, run.clock)
  ctx.fillStyle = unlocked ? lime : "#9cb5a2"
  ctx.textAlign = "center"
  ctx.fillText("ЯДРО БАНКА", core.x, core.y + 43)
}

export function createRenderer(ctx: CanvasRenderingContext2D) {
  const floor = makeFloor()
  const agent = createAgentDrawing()

  return (run: Run, displayWidth: number, touchControls: boolean) => {
    const { width, height } = ctx.canvas
    const zoomed = displayWidth < 620 && run.phase !== "briefing"
    const scale = zoomed
      ? Math.max(width / clamp(displayWidth * 1.28, 435, mapSize.width), height / mapSize.height)
      : Math.min(width / mapSize.width, height / mapSize.height)
    const viewWidth = width / scale
    const viewHeight = height / scale
    const left = viewWidth >= mapSize.width ? (mapSize.width - viewWidth) / 2 : clamp(run.agent.x - viewWidth / 2, 0, mapSize.width - viewWidth)
    const top = viewHeight >= mapSize.height ? (mapSize.height - viewHeight) / 2 : clamp(run.agent.y - viewHeight / 2, 0, mapSize.height - viewHeight)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = "#070b09"
    ctx.fillRect(0, 0, width, height)
    ctx.setTransform(scale, 0, 0, scale, -left * scale, -top * scale)
    ctx.drawImage(floor, 0, 0, mapSize.width, mapSize.height)
    const moving = agent.update(run)
    agent.paintFootprints(ctx, run.visualTime)
    paintRackLights(ctx, racks, run.clock)

    const obstacles = activeWalls(run)
    run.threats.forEach((threat, index) => paintThreat(ctx, threat, index >= cameras.length, run.clock, obstacles))
    ctx.fillStyle = "rgba(0,0,0,0.35)"
    for (const wall of walls) ctx.fillRect(wall.x + 4, wall.y + 5, wall.w, wall.h)
    ctx.fillStyle = "#25372c"
    ctx.strokeStyle = "#4c6453"
    ctx.lineWidth = 1
    for (const wall of walls) {
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h)
      ctx.strokeRect(wall.x + .5, wall.y + .5, wall.w - 1, wall.h - 1)
    }
    ctx.fillStyle = "rgba(255,255,255,0.12)"
    for (const wall of walls) ctx.fillRect(wall.x + 1, wall.y + 1, wall.w - 2, 1)
    run.threats.forEach((threat, index) => paintDevice(ctx, threat, index >= cameras.length, run.clock))
    paintPickups(ctx, run)
    findings.forEach((finding, index) => paintFinding(ctx, run, finding, index))

    const unlocked = run.scanned.length === findings.length
    paintGate(ctx, run, unlocked)
    const objective = unlocked ? (run.agent.x < gate.x ? gateApproach : core)
      : findings.find(finding => finding.puzzle === nextObjective(run.events))
    if ((zoomed || unlocked) && objective) {
      const x = clamp(objective.x, left + 27, left + viewWidth - 27)
      const y = clamp(objective.y, top + 32, top + viewHeight - 38)
      if (x !== objective.x || y !== objective.y || (unlocked && objective === gateApproach)) {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(Math.atan2(objective.y - run.agent.y, objective.x - run.agent.x))
        ctx.fillStyle = lime
        ctx.strokeStyle = "#0b1710"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(8, 0)
        ctx.lineTo(-6, -6)
        ctx.lineTo(-3, 0)
        ctx.lineTo(-6, 6)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }
    }

    if (run.wave) {
      const progress = (run.clock - run.wave.at) / .55
      if (progress < 1) {
        circle(ctx, run.wave.x, run.wave.y, Math.max(1, empRadius * progress))
        ctx.strokeStyle = mint
        ctx.fillStyle = "#a7f3d02b"
        ctx.lineWidth = 4
        ctx.globalAlpha = 1 - progress
        ctx.fill()
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
    for (const burst of run.bursts) {
      const progress = clamp((run.visualTime - burst.at) / .85, 0, 1)
      ctx.globalAlpha = 1 - progress
      for (let index = 0; index < burst.count; index += 1) {
        const angle = index * 2.4
        const length = progress * (19 + (index * 7) % 52)
        ctx.fillStyle = index % 3 === 0 ? lime : mint
        ctx.fillRect(burst.x + Math.cos(angle) * length, burst.y + Math.sin(angle) * length, 3 + index % 3, 2)
      }
    }
    ctx.globalAlpha = 1

    const { x, y } = run.agent
    agent.paintAgent(ctx, run, moving)

    ctx.textAlign = "center"
    ctx.font = `bold 16px ${mono}`
    ctx.lineWidth = 4
    ctx.strokeStyle = "#08120b"
    ctx.fillStyle = lime
    for (const item of run.popups) {
      const progress = clamp((run.visualTime - item.at) / 1.45, 0, 1)
      const popupX = clamp(item.x, left + 115, left + viewWidth - 115)
      const popupY = clamp(item.y - 35 - progress * 47, top + 27, top + viewHeight - 25)
      ctx.globalAlpha = Math.min(1, (1 - progress) * 2.5)
      ctx.strokeText(item.text, popupX, popupY)
      ctx.fillText(item.text, popupX, popupY)
    }
    ctx.globalAlpha = 1

    if (!run.moved && run.phase === "playing") {
      ctx.font = `bold 13px ${mono}`
      ctx.textAlign = "left"
      const hint = touchControls ? "Веди джойстик" : "WASD — идти"
      ctx.fillStyle = "#101512ed"
      ctx.fillRect(x - 16, y - 48, ctx.measureText(hint).width + 16, 23)
      ctx.fillStyle = mint
      ctx.fillText(hint, x - 8, y - 32)
    }

    const target = findings[run.focus]
    if (target && run.phase === "playing") {
      return { x: (target.x - left) / viewWidth, y: (target.y - top - 17) / viewHeight }
    }
  }
}
