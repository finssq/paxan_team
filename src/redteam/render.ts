import { cameras, core, desks, findings, gate, gateApproach, mapSize, pickups, racks, rooms, walls } from "./mapData"
import type { Point, Rect } from "./mapData"
import { createAgentDrawing } from "./canvasDraw"
import { activeWalls, clamp, empDuration, empRadius, fullTurn, nextObjective, rayDistance, scanRadius } from "./simulation"
import type { Run, Threat } from "./simulation"

const lime = "#8EE872"
const mint = "#A7F3D0"
const cyan = "#38BDF8"
const amber = "#F59E0B"
const gold = "#FDE047"
const shadow = "rgba(0,0,0,0.28)"
const mono = "ui-monospace, Consolas, monospace"
const roomPaint = {
  "РЕСЕПШЕН": { floor: "#262C2B", tile: "#262C2B", accent: "#C89D54", spacing: 44 },
  "ОФИС": { floor: "#1D3431", tile: "#203936", accent: lime, spacing: 48 },
  "IT-ЗОНА": { floor: "#182F3B", tile: "#1B3543", accent: cyan, spacing: 52 },
  "СЕРВЕРНАЯ": { floor: "#131E2C", tile: "#131E2C", accent: "#EF4444", spacing: 32 },
}
const serverDivider = gate.x + gate.w / 2
const floorZones: Record<keyof typeof roomPaint, Rect> = {
  "РЕСЕПШЕН": { x: 26, y: 330, w: 297 - 26, h: 514 - 330 },
  "ОФИС": { x: 26, y: 26, w: 297 - 26, h: 330 - 26 },
  "IT-ЗОНА": { x: 297, y: 26, w: serverDivider - 297, h: 514 - 26 },
  "СЕРВЕРНАЯ": { x: serverDivider, y: 26, w: 934 - serverDivider, h: 514 - 26 },
}
const findingColors = { sniffer: lime, laptop: amber, osint: gold }
type Canvas = CanvasRenderingContext2D

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

function fillRound(ctx: Canvas, x: number, y: number, w: number, h: number, radius: number, fill: string) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, radius)
  ctx.fillStyle = fill
  ctx.fill()
}

function paintLabel(ctx: Canvas, text: string, x: number, y: number, align: "center" | "right" = "center") {
  ctx.save()
  ctx.font = `bold 12px ${mono}`
  const width = ctx.measureText(text).width
  const left = align === "right" ? x - width : x - width / 2
  fillRound(ctx, left - 6, y - 10, width + 12, 20, 5, "rgba(10,15,13,0.84)")
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillStyle = "#FFFFFF"
  ctx.fillText(text, left, y)
  ctx.restore()
}

function roomStyle(label: string) {
  return roomPaint[label as keyof typeof roomPaint] ?? roomPaint["ОФИС"]
}

function makeMapLayer(paint: (ctx: CanvasRenderingContext2D) => void) {
  const floor = document.createElement("canvas")
  floor.width = mapSize.width * 2
  floor.height = mapSize.height * 2
  const ctx = floor.getContext("2d")
  if (ctx) {
    ctx.scale(2, 2)
    paint(ctx)
  }
  return floor
}

function paintFloor(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#0E161A"
  ctx.fillRect(0, 0, mapSize.width, mapSize.height)
  for (const label of Object.keys(floorZones) as (keyof typeof floorZones)[]) {
    const { x, y, w, h } = floorZones[label]
    const { floor, tile, spacing } = roomPaint[label]
    const server = label === "СЕРВЕРНАЯ"
    ctx.fillStyle = floor
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = server ? "rgba(142,232,114,0.045)" : "rgba(255,255,255,0.04)"
    ctx.lineWidth = 1
    for (let row = 0, dy = 0; dy < h; row += 1, dy += spacing) {
      for (let col = 0, dx = 0; dx < w; col += 1, dx += spacing) {
        const cellW = Math.min(spacing, w - dx)
        const cellH = Math.min(spacing, h - dy)
        const tx = x + dx
        const ty = y + dy
        if ((row + col) % 2 === 0) {
          ctx.fillStyle = tile
          ctx.fillRect(tx, ty, cellW, cellH)
        }
        ctx.beginPath()
        ctx.moveTo(tx + .5, ty + cellH)
        ctx.lineTo(tx + .5, ty + .5)
        ctx.lineTo(tx + cellW, ty + .5)
        ctx.stroke()
        if (server && (row + col * 2) % 5 === 0) {
          ctx.fillStyle = "rgba(142,232,114,0.045)"
          for (let vent = 7; vent < Math.min(19, cellH - 3); vent += 3) {
            ctx.fillRect(tx + 6, ty + vent, Math.max(0, cellW - 12), 1)
          }
        }
      }
    }
  }
  const { x, y, w, h } = floorZones["РЕСЕПШЕН"]
  const rugWidth = 90
  const rugHeight = 38
  const wifi = findings.find(finding => finding.puzzle === "sniffer")
  const furniture = wifi ? [...desks, { x: wifi.x - 20, y: wifi.y - 17, w: 40, h: 35 }] : desks
  const rug = [
    { x: x + w / 2 - 23, y: y + h / 2 - 31 },
    { x: x + w - rugWidth - 16, y: y + 44 },
    { x: x + w - rugWidth - 16, y: y + h - rugHeight - 16 },
    { x: x + 26, y: y + h - rugHeight - 16 },
  ].find(rug => furniture.every(item =>
    rug.x + rugWidth + 5 <= item.x || rug.x - 5 >= item.x + item.w ||
    rug.y + rugHeight + 5 <= item.y || rug.y - 5 >= item.y + item.h,
  ))
  if (!rug) return
  fillRound(ctx, rug.x + 2, rug.y + 3, rugWidth, rugHeight, 4, shadow)
  fillRound(ctx, rug.x, rug.y, rugWidth, rugHeight, 4, "#2E3A36")
  ctx.strokeStyle = "#C89D54"
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function paintFurniture(ctx: CanvasRenderingContext2D) {
  const screens = [cyan, lime, "#FBBF24"]
  desks.forEach(({ x, y, w, h }, index) => {
    const center = x + w / 2
    const color = screens[index % screens.length]!
    fillRound(ctx, x + 4, y + 5, w, h, 4, shadow)
    fillRound(ctx, center - 9, y + h - 1, 18, 12, 4, "#1C282E")
    ctx.strokeStyle = "#364C57"
    ctx.lineWidth = 1
    ctx.stroke()
    fillRound(ctx, center - 10, y + h + 6, 20, 4, 2, "#364C57")
    fillRound(ctx, x, y, w, h, 4, "#2C3E47")
    ctx.strokeStyle = "#4C6573"
    ctx.stroke()
    fillRound(ctx, center - 13, y + 6, 26, 6, 1, "#0A1116")
    ctx.fillStyle = color
    ctx.fillRect(center - 11, y + 8, 22, 2)
    fillRound(ctx, center - 8, y + 16, 16, 5, 1, "#16232B")
    ctx.fillStyle = "#5C7482"
    ctx.fillRect(center - 5, y + 18, 10, 1)
    fillRound(ctx, x + w - 12, y + h - 12, 5, 8, 2, "#1C282E")
  })

  for (const [x, y] of [[55, 300], [327, 477], [917, 245]] as const) {
    fillRound(ctx, x - 5, y - 3, 17, 16, 6, shadow)
    fillRound(ctx, x - 8, y - 7, 16, 15, 5, "#1A2428")
    fillRound(ctx, x - 9, y - 8, 18, 9, 4, "#1A2428")
    ctx.strokeStyle = "#526D73"
    ctx.stroke()
    ctx.save()
    ctx.translate(x, y - 3)
    for (let leaf = 0; leaf < 6; leaf += 1) {
      ctx.rotate(fullTurn / 6)
      ctx.beginPath()
      ctx.ellipse(4.5, 0, 6.5, 3, .18, 0, fullTurn)
      ctx.fillStyle = leaf % 2 ? "#16A34A" : "#22C55E"
      ctx.fill()
      ctx.fillStyle = "#4ADE80"
      ctx.fillRect(3, -.5, 5, 1)
    }
    ctx.restore()
  }

  for (const { x, y, w, h } of racks) {
    fillRound(ctx, x + 4, y + 5, w, h, 3, shadow)
    fillRound(ctx, x, y, w, h, 3, "#162330")
    ctx.strokeStyle = "#2E4659"
    ctx.stroke()
    for (let row = 6; row < h - 6; row += 9) fillRound(ctx, x + 3, y + row, w - 6, 6, 1, "#0A1116")
  }

  for (const { x, y, name } of rooms) {
    const label = name.replace("ИТ-ЗОНА", "IT-ЗОНА")
    const { accent } = roomStyle(label)
    ctx.font = `bold 13px ${mono}`
    fillRound(ctx, x - 3, y - 15, ctx.measureText(label).width + 20, 21, 4, "rgba(0,0,0,0.45)")
    ctx.strokeStyle = accent + "55"
    ctx.lineWidth = 1
    ctx.stroke()
    fillRound(ctx, x - 3, y - 15, 3, 21, 1, accent)
    ctx.fillStyle = "#ECF5F3"
    ctx.fillText(label, x + 7, y)
  }
}

function paintRackLights(ctx: Canvas, clock: number) {
  ctx.save()
  const lights = [lime, cyan, amber]
  racks.forEach(({ x, y, w, h }, index) => {
    for (let row = 6; row < h - 6; row += 9) {
      const color = lights[(index + (row - 6) / 9) % lights.length]!
      ctx.globalAlpha = .53 + .47 * (.5 + .5 * Math.sin(clock * (1.9 + index * .2) + row))
      ctx.fillStyle = color
      ctx.fillRect(x + w - 11, y + row + 2, 2, 2)
      ctx.fillRect(x + w - 6, y + row + 2, 2, 2)
    }
  })
  ctx.restore()
}

function paintAgent(ctx: Canvas, { x, y }: Point, facing: 1 | -1, stride: number, playerNickname: string) {
  const outline = "#101613"
  const clothingOutline = "#0A0E0C"
  const jacket = "#DC2626"
  const fabricShade = "#991B1B"
  const skin = "#FAD2B4"
  const skinShade = "#E4B18C"
  const rimLight = "rgba(255,255,255,0.35)"
  const bob = Math.abs(stride) / 2.7 * 1.8
  ctx.save()
  ctx.translate(x, y)
  ctx.save()
  ctx.translate(0, 1.5)
  ctx.scale(1, .38)
  const shadow = ctx.createRadialGradient(0, 0, 4, 0, 0, 12)
  shadow.addColorStop(0, "rgba(0,0,0,0.45)")
  shadow.addColorStop(1, "rgba(0,0,0,0)")
  circle(ctx, 0, 0, 12)
  ctx.fillStyle = shadow
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.scale(facing, 1)
  ctx.strokeStyle = clothingOutline
  ctx.lineWidth = 1.5
  for (const side of [-1, 1]) {
    const step = stride * side
    const footX = side * 3.5 + step
    const footY = (side === 1 ? 0 : -2) - Math.max(0, step) * .28
    fillRound(ctx, footX - 3.1, footY - 12, 6.3, 11, 2.3, "#111518")
    ctx.stroke()
    fillRound(ctx, footX - 1.75, footY - 9.7, 1.05, 5.4, .5, "#232A30")

    fillRound(ctx, footX - 3.15, footY - 2.65, 9.5, 4.15, 1.5, "#D1C8BA")
    ctx.stroke()
    fillRound(ctx, footX - 2.75, footY - 6.1, 6.05, 5.25, 1.5, "#202124")
    fillRound(ctx, footX - 2.75, footY - 3.65, 8.35, 2.85, 1.4, "#202124")
    fillRound(ctx, footX + 2.65, footY - 3.1, 2.95, 1.8, .85, "#E4DACB")
    fillRound(ctx, footX - 1.45, footY - 4.7, 3.1, .75, .35, "#BEB6AC")
    fillRound(ctx, footX - 1.05, footY - 3.55, 2.75, .75, .35, "#BEB6AC")
  }

  ctx.translate(0, -bob)
  function paintSleeve(shoulderX: number, angle: number, fabric: string) {
    ctx.save()
    ctx.translate(shoulderX, -19)
    ctx.rotate(angle)
    fillRound(ctx, -2.2, 7.8, 4.5, 4.3, 2, skin)
    ctx.stroke()
    fillRound(ctx, -3.65, -1.4, 7.3, 10, 3.5, fabric)
    ctx.stroke()
    fillRound(ctx, -2, 6.1, 4, 1.4, .65, fabricShade)
    ctx.restore()
  }
  paintSleeve(6.4, -.24 + stride * .12, "#B91C1C")

  const torso = new Path2D()
  torso.moveTo(-8.5, -19)
  torso.quadraticCurveTo(-8.4, -23, .5, -23)
  torso.quadraticCurveTo(9.3, -23, 9.5, -18.6)
  torso.lineTo(8.5, -10)
  torso.quadraticCurveTo(7.7, -7.1, 1, -7.1)
  torso.quadraticCurveTo(-6.9, -7.1, -7.3, -10)
  torso.closePath()
  ctx.fillStyle = jacket
  ctx.fill(torso)
  ctx.save()
  ctx.clip(torso)
  ctx.fillStyle = fabricShade
  ctx.fillRect(-9, -11, 19, 4.5)
  ctx.beginPath()
  ctx.moveTo(-1.1, -23.5)
  ctx.lineTo(5.9, -23.5)
  ctx.lineTo(4.4, -7.1)
  ctx.lineTo(.3, -7.1)
  ctx.closePath()
  ctx.fillStyle = "#14181A"
  ctx.fill()
  ctx.restore()
  ctx.stroke(torso)
  paintSleeve(-6, .16 - stride * .12, jacket)
  ctx.strokeStyle = rimLight
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-9.1, -17.9)
  ctx.quadraticCurveTo(-9.3, -20.9, -5.7, -21.7)
  ctx.moveTo(5.4, -22.4)
  ctx.quadraticCurveTo(8.1, -21.6, 8.8, -18.7)
  ctx.stroke()

  ctx.strokeStyle = outline
  ctx.lineWidth = 1.15
  fillRound(ctx, -.75, -26.1, 5.2, 5.9, 2, skinShade)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(1.8, -29.5, 7.4, 6.7, 0, 0, fullTurn)
  ctx.fillStyle = skinShade
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(2.6, -30.2, 6.3, 5.75, 0, 0, fullTurn)
  ctx.fillStyle = skin
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(-5.9, -28.4)
  ctx.bezierCurveTo(-8, -33.7, -4.5, -37.8, .4, -37.8)
  ctx.quadraticCurveTo(6.8, -38, 8.9, -33.8)
  ctx.quadraticCurveTo(8, -32.1, 5, -31.8)
  ctx.quadraticCurveTo(5.4, -32.4, 5.3, -33.2)
  ctx.quadraticCurveTo(2.5, -31.3, -.7, -31.2)
  ctx.quadraticCurveTo(-2.2, -30.8, -2.6, -28.1)
  ctx.quadraticCurveTo(-4.8, -29.6, -5.9, -28.4)
  ctx.closePath()
  ctx.fillStyle = "#4A2E20"
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-4.9, -33.3)
  ctx.quadraticCurveTo(-.8, -38.1, 5.6, -35.4)
  ctx.quadraticCurveTo(2.7, -35.7, -1.6, -33.5)
  ctx.closePath()
  ctx.fillStyle = "#754C36"
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-6.5, -32.5)
  ctx.quadraticCurveTo(-5.1, -38.2, 1.7, -37.8)
  ctx.strokeStyle = rimLight
  ctx.stroke()

  for (const eyeX of [2, 6.1]) {
    fillRound(ctx, eyeX - 1, -30.15, 2, 2.8, .85, "#141A1D")
    fillRound(ctx, eyeX - .45, -29.9, .75, .75, .35, "#FFFFFF")
  }
  const markerTip = -45 + Math.sin(performance.now() * .004)
  ctx.beginPath()
  ctx.moveTo(-4, markerTip - 5)
  ctx.lineTo(4, markerTip - 5)
  ctx.lineTo(0, markerTip)
  ctx.closePath()
  ctx.fillStyle = lime
  ctx.fill()
  ctx.strokeStyle = outline
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()

  const badgeTop = markerTip - bob - 25
  ctx.font = "600 10px Inter, system-ui, sans-serif"
  const badgeWidth = ctx.measureText(playerNickname).width + 12
  fillRound(ctx, -badgeWidth / 2, badgeTop, badgeWidth, 16, 6, "rgba(10,15,13,0.82)")
  ctx.strokeStyle = "rgba(142,232,114,0.45)"
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillStyle = "#F4F8F6"
  ctx.fillText(playerNickname, 0, badgeTop + 8)
  ctx.restore()
}

function paintWalls(ctx: Canvas) {
  ctx.fillStyle = "rgba(0,0,0,0.32)"
  for (const { x, y, w, h } of walls) ctx.fillRect(x + 3, y + 4, w, h)
  ctx.lineWidth = 1
  ctx.strokeStyle = "#060A0C"
  for (const { x, y, w, h } of walls) {
    ctx.fillStyle = "#0E161A"
    ctx.fillRect(x, y, w, h)
    ctx.strokeRect(x + .5, y + .5, w - 1, h - 1)
    ctx.fillStyle = "#49656B"
    ctx.fillRect(x + 1, y + 1, w - 2, 1.5)
    ctx.fillRect(x + 1, y + 2.5, 1.5, h - 3.5)
  }
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
    ctx.fillStyle = "rgba(239,68,68,0.28)"
    ctx.strokeStyle = "#FF5560"
    ctx.lineWidth = 1.5
    ctx.fill()
    ctx.stroke()
    if (drone) {
      ctx.save()
      ctx.clip()
      const pulse = (clock * .75 + x * .01) % 1
      circle(ctx, x, y, range * pulse)
      ctx.globalAlpha = .65 * (1 - pulse)
      ctx.strokeStyle = "#FFD0CF"
      ctx.setLineDash([5, 4])
      ctx.stroke()
      ctx.restore()
    }

    const beam = drone ? clock * 2 : angle + Math.sin(clock * 4) * halfAngle * .86
    const dx = Math.cos(beam)
    const dy = Math.sin(beam)
    const length = rayDistance(x, y, dx, dy, range, obstacles)
    ctx.strokeStyle = "#FFB1AD"
    ctx.lineWidth = 1.5
    trace(ctx, [{ x, y }, { x: x + dx * length, y: y + dy * length }])
  }
}

function paintDevice(ctx: CanvasRenderingContext2D, threat: Threat, drone: boolean, clock: number) {
  const { x, y, angle, disabledUntil } = threat
  const remaining = disabledUntil - clock
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  const lamp = remaining > 0 ? lime : "#FF4D5E"
  ctx.lineWidth = 1.25
  ctx.strokeStyle = "#17221E"
  if (drone) {
    for (const dx of [-8, 8]) {
      for (const dy of [-8, 8]) {
        circle(ctx, dx, dy, 4.5)
        ctx.fillStyle = "#91A5AB"
        ctx.fill()
        ctx.stroke()
        ctx.strokeStyle = "#374C54"
        trace(ctx, [{ x: dx - 2.5, y: dy }, { x: dx + 2.5, y: dy }])
        ctx.strokeStyle = "#17221E"
      }
    }
  }
  fillRound(ctx, -8, -5.5, 17, 11, 3, drone ? "#344C59" : "#71877F")
  ctx.stroke()
  fillRound(ctx, 4, -3, 6, 6, 1, lamp)
  ctx.stroke()
  ctx.restore()
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

function paintPickups(ctx: Canvas, run: Run) {
  for (const item of pickups) {
    if (run.collected.includes(item.id)) continue
    const y = item.y + Math.sin(run.clock * 3 + item.x * .1) * 2.5
    const color = item.id === "staff_badge" ? lime : amber
    circle(ctx, item.x + 2, item.y + 3, 12)
    ctx.fillStyle = shadow
    ctx.fill()
    circle(ctx, item.x, y, 12)
    ctx.fillStyle = "#182420"
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()
    if (item.id === "emp_cell") {
      fillRound(ctx, item.x - 4, y - 6, 8, 12, 2, color)
      ctx.fillRect(item.x - 2, y - 8, 4, 2)
      ctx.fillStyle = "#182420"
      ctx.fillRect(item.x - 1, y - 3, 2, 6)
    } else {
      fillRound(ctx, item.x - 7, y - 4, 14, 8, 2, color)
      ctx.fillStyle = "#182420"
      ctx.fillRect(item.x - 4, y - 2, 2, 4)
      ctx.fillRect(item.x + 1, y - 1, 3, 2)
    }
    if (Math.hypot(item.x - run.agent.x, item.y - run.agent.y) < 95) {
      paintLabel(ctx, item.label, clamp(item.x, 83, mapSize.width - 83), item.y + 24)
    }
  }
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

  ctx.save()
  const color = findingColors[puzzle]
  ctx.translate(x, y)
  fillRound(ctx, -13, -10, 30, 25, 4, shadow)
  fillRound(ctx, -15, -12, 30, 25, 4, "#182420")
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()
  if (puzzle === "sniffer") {
    ctx.lineWidth = 1.6
    for (let wave = 0; wave < 3; wave += 1) {
      ctx.beginPath()
      ctx.arc(0, 7, 4 + wave * 4, -2.25, -.89)
      ctx.stroke()
    }
    circle(ctx, 0, 7, 1.4)
    ctx.fillStyle = color
    ctx.fill()
  } else if (puzzle === "laptop") {
    fillRound(ctx, -9, -8, 18, 10, 1, "#FBBF24")
    ctx.fillStyle = "#FFF9E0"
    ctx.fillRect(-6, -6, 10, 1)
    ctx.fillRect(-6, -4, 6, 1)
    fillRound(ctx, -10, 4, 20, 5, 1, "#789391")
    ctx.fillStyle = "#253B34"
    for (let key = -8; key < 8; key += 3) ctx.fillRect(key, 5, 2, 2)
  } else {
    ctx.rotate(.12)
    fillRound(ctx, -7, -9, 14, 18, 1, gold)
    ctx.fillStyle = "#7A4D10"
    ctx.fillRect(-4, -4, 8, 1)
    ctx.fillRect(-4, -1, 6, 1)
    ctx.fillRect(-4, 2, 7, 1)
    ctx.rotate(-.12)
  }
  if (found) {
    circle(ctx, 12, -10, 7)
    ctx.fillStyle = "#182420"
    ctx.fill()
    ctx.strokeStyle = lime
    ctx.stroke()
    trace(ctx, [{ x: 9, y: -10 }, { x: 11, y: -8 }, { x: 15, y: -12 }])
  }
  ctx.restore()
  paintLabel(ctx, short, x, y + 41)
}

function paintGate(ctx: CanvasRenderingContext2D, run: Run, unlocked: boolean) {
  const x = gate.x + gate.w / 2
  const y = gate.y + gate.h / 2
  if (!unlocked) {
    ctx.save()
    for (let beam = -1; beam <= 1; beam += 1) {
      const laserX = x + beam * 3.5
      ctx.globalAlpha = .77 + .23 * Math.sin(run.clock * 12 + beam * 1.3)
      ctx.strokeStyle = "#FF4D5E"
      ctx.lineWidth = 2.6
      trace(ctx, [{ x: laserX, y: gate.y + 3 }, { x: laserX, y: gate.y + gate.h - 3 }])
      ctx.strokeStyle = "#FFF3EE"
      ctx.lineWidth = .8
      ctx.stroke()
    }
    ctx.restore()
  }
  for (const end of [gate.y, gate.y + gate.h]) {
    fillRound(ctx, x - 8, end - 4, 16, 8, 2, "#17221E")
    fillRound(ctx, x - 5.5, end - 2, 11, 4, 1, unlocked ? lime : "#FF4D5E")
  }
  fillRound(ctx, x - 18, gate.y - 24, 36, 14, 4, "#0E161A")
  ctx.strokeStyle = "#49656B"
  ctx.lineWidth = 1
  ctx.stroke()
  for (let index = 0; index < 3; index += 1) {
    circle(ctx, x - 10 + index * 10, gate.y - 17, 2.5)
    ctx.fillStyle = index < run.scanned.length ? lime : "#EF4444"
    ctx.fill()
  }
  paintLabel(ctx, unlocked ? "ШЛЮЗ ОТКРЫТ" : "ШЛЮЗ ЗАКРЫТ", x - 15, y - 22, "right")

  ctx.save()
  ctx.translate(core.x, core.y)
  circle(ctx, 3, 4, 24)
  ctx.fillStyle = shadow
  ctx.fill()
  circle(ctx, 0, 0, 23)
  ctx.fillStyle = "#182E2A"
  ctx.fill()
  ctx.strokeStyle = "#99ABD0"
  ctx.lineWidth = 1
  ctx.stroke()
  for (const [radius, speed, color] of [[21, .72, lime], [15, -1.05, gold]] as const) {
    ctx.save()
    ctx.rotate(run.clock * speed)
    ctx.setLineDash([radius * 1.1, radius * .47])
    ctx.lineWidth = unlocked ? 2.5 : 1.8
    circle(ctx, 0, 0, radius)
    ctx.strokeStyle = color
    ctx.stroke()
    ctx.restore()
  }
  ctx.beginPath()
  ctx.moveTo(0, -12)
  ctx.lineTo(9, 0)
  ctx.lineTo(0, 12)
  ctx.lineTo(-9, 0)
  ctx.closePath()
  ctx.fillStyle = lime
  ctx.fill()
  ctx.strokeStyle = "#D9FF9E"
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, -10)
  ctx.lineTo(3, 0)
  ctx.lineTo(0, 8)
  ctx.lineTo(-3, 0)
  ctx.closePath()
  ctx.fillStyle = "#FFFDEB"
  ctx.fill()
  ctx.restore()
  paintLabel(ctx, "ЯДРО БАНКА", core.x, core.y + 40)
}

function paintGuideArrow(ctx: Canvas, point: Point, angle: number, opacity: number) {
  ctx.save()
  ctx.translate(point.x, point.y)
  ctx.rotate(angle)
  ctx.globalAlpha = opacity
  ctx.fillStyle = lime
  ctx.strokeStyle = "#0B1710"
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(9, 0)
  ctx.lineTo(-5, -6)
  ctx.lineTo(-2, 0)
  ctx.lineTo(-5, 6)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function paintObjectiveMarker(ctx: Canvas, objective: Point, clock: number) {
  const { x, y } = objective
  const bob = Math.sin(clock * 4.6) * 3
  const tip = y - 34 + bob
  ctx.save()
  ctx.font = `bold 11px ${mono}`
  const width = ctx.measureText("ЦЕЛЬ").width + 14
  fillRound(ctx, x - width / 2, tip - 28, width, 17, 5, lime)
  ctx.strokeStyle = "#0B1710"
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = "#10200B"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("ЦЕЛЬ", x, tip - 19)
  ctx.restore()
  paintGuideArrow(ctx, { x, y: tip - 8 }, Math.PI / 2, 1)
}

export function createRenderer(ctx: CanvasRenderingContext2D) {
  const floor = makeMapLayer(paintFloor)
  const furniture = makeMapLayer(paintFurniture)
  const agent = createAgentDrawing()
  let previousAgent: (Point & { run: Run }) | undefined
  let walkPhase = 0
  let facing: 1 | -1 = 1

  return (run: Run, displayWidth: number, playerNickname: string, reduceMotion: boolean) => {
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
    ctx.fillStyle = "#0E161A"
    ctx.fillRect(0, 0, width, height)
    ctx.setTransform(scale, 0, 0, scale, -left * scale, -top * scale)
    ctx.drawImage(floor, 0, 0, mapSize.width, mapSize.height)
    const moving = agent.update(run)
    const { x, y } = run.agent
    if (previousAgent?.run === run) {
      const dx = x - previousAgent.x
      if (Math.abs(dx) > .01) facing = dx < 0 ? -1 : 1
      walkPhase = (walkPhase + Math.hypot(dx, y - previousAgent.y) * .18) % fullTurn
    } else {
      facing = 1
      walkPhase = 0
    }
    previousAgent = { x, y, run }
    ctx.drawImage(furniture, 0, 0, mapSize.width, mapSize.height)
    agent.paintFootprints(ctx, run.visualTime)
    paintRackLights(ctx, run.clock)

    const obstacles = activeWalls(run)
    run.threats.forEach((threat, index) => paintThreat(ctx, threat, index >= cameras.length, run.clock, obstacles))
    paintWalls(ctx)
    run.threats.forEach((threat, index) => paintDevice(ctx, threat, index >= cameras.length, run.clock))
    paintPickups(ctx, run)
    findings.forEach((finding, index) => paintFinding(ctx, run, finding, index))

    const unlocked = run.scanned.length === findings.length
    paintGate(ctx, run, unlocked)
    const objective = unlocked ? core
      : findings.find(finding => finding.puzzle === nextObjective(run.events))
    if (run.phase === "playing" && objective) {
      paintObjectiveMarker(ctx, objective, reduceMotion ? 0 : run.visualTime)
      const routePoint = unlocked && x < gate.x ? gateApproach : objective
      const dx = routePoint.x - x
      const dy = routePoint.y - y
      const angle = Math.atan2(dy, dx)
      if (zoomed && (objective.x < left || objective.x > left + viewWidth || objective.y < top || objective.y > top + viewHeight)) {
        const edge = { x: clamp(routePoint.x, left + 24, left + viewWidth - 24), y: clamp(routePoint.y, top + 64, top + viewHeight - 58) }
        paintGuideArrow(ctx, edge, angle, .88)
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

    paintAgent(ctx, run.agent, facing, moving ? Math.sin(walkPhase) * 2.7 : 0, playerNickname)

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

    const target = findings[run.focus]
    if (target && run.phase === "playing") {
      return { x: (target.x - left) / viewWidth, y: (target.y - top) / viewHeight }
    }
  }
}
