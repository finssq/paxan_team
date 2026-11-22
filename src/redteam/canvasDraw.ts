import type { Point, PuzzleKind, Rect } from "./mapData"
import { mapSize, pickups } from "./mapData"
import { agentRadius, empDuration, fullTurn } from "./simulation"
import type { Run, Threat } from "./simulation"

type Canvas = CanvasRenderingContext2D
const graphite = "#070B09"
const lime = "#8EE872"
const coral = "#EF4444"
const amber = "#F59E0B"
const rim = "rgba(255,255,255,0.12)"
const targetLights = { sniffer: "#8EE87236", laptop: "#F59E0B3A", osint: "#FDE04732" } satisfies Record<PuzzleKind, string>
const roomLights = {
  "РЕСЕПШЕН": { floor: "#F59E0B08", light: "rgba(245,158,11,0.06)", mark: amber },
  "ОФИС": { floor: "#0D120F62", light: "#F59E0B0C", mark: "#C6AD79" },
  "IT-ЗОНА": { floor: "#34D39906", light: "rgba(52,211,153,0.055)", mark: "#34D399" },
  "СЕРВЕРНАЯ": { floor: "rgba(4,8,6,0.45)", light: "#34D3990A", mark: lime },
}

type RoomLabel = keyof typeof roomLights

function rounded(ctx: Canvas, x: number, y: number, width: number, height: number, radius: number, color: string) {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
  ctx.fillStyle = color
  ctx.fill()
}

function disk(ctx: Canvas, x: number, y: number, radius: number, color: string) {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, fullTurn)
  ctx.fillStyle = color
  ctx.fill()
}

function glow(ctx: Canvas, x: number, y: number, radius: number, inner: string) {
  const light = ctx.createRadialGradient(x, y, 0, x, y, radius)
  light.addColorStop(0, inner)
  light.addColorStop(1, "transparent")
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, fullTurn)
  ctx.fillStyle = light
  ctx.fill()
}

export function paintRoomFloor(ctx: Canvas, { x, y, w, h }: Rect, label: string, entrance?: Point) {
  const { floor, light } = roomLights[label as RoomLabel] ?? roomLights["ОФИС"]
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.fillStyle = floor
  ctx.fillRect(x, y, w, h)
  glow(ctx, x + w * .48, y + h * .54, Math.max(w, h) * .68, light)
  if (entrance) {
    const matX = entrance.x - 24
    const matY = entrance.y - 15
    glow(ctx, entrance.x, entrance.y, 84, "rgba(245,158,11,0.06)")
    rounded(ctx, matX, matY + 3, 72, 30, 3, "#070B09BF")
    rounded(ctx, matX, matY, 72, 30, 3, "#F59E0B1C")
    ctx.strokeStyle = "#F59E0B39"
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.strokeRect(matX + 4, matY + 4, 64, 22)
  }
  ctx.restore()
}

export function paintRoomLabel(ctx: Canvas, x: number, y: number, label: string) {
  ctx.save()
  ctx.font = "bold 14px ui-monospace, Consolas, monospace"
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  disk(ctx, x + 2, y - 5, 2, (roomLights[label as RoomLabel] ?? roomLights["ОФИС"]).mark)
  ctx.lineWidth = 3
  ctx.strokeStyle = "#070B09CD"
  ctx.strokeText(label, x + 10, y)
  ctx.fillStyle = "#B4C6B8"
  ctx.fillText(label, x + 10, y)
  ctx.restore()
}

export function paintVignette(ctx: Canvas) {
  const { width, height } = ctx.canvas
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.translate(width / 2, height / 2)
  ctx.scale(width / 2, height / 2)
  const shade = ctx.createRadialGradient(0, 0, .52, 0, 0, Math.SQRT2)
  shade.addColorStop(0, "rgba(0,0,0,0)")
  shade.addColorStop(.65, "rgba(0,0,0,0.10)")
  shade.addColorStop(1, "rgba(0,0,0,0.28)")
  ctx.fillStyle = shade
  ctx.fillRect(-1, -1, 2, 2)
  ctx.restore()
}

export function paintDataCable(ctx: Canvas, points: readonly [Point, ...Point[]], found: boolean, clock: number, offset: number) {
  const [start, ...bends] = points
  ctx.save()
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  for (const point of bends) ctx.lineTo(point.x, point.y)
  ctx.strokeStyle = "#070B09B3"
  ctx.lineWidth = 5
  ctx.stroke()
  ctx.strokeStyle = found ? "rgba(142,232,114,0.55)" : "rgba(245,158,11,0.22)"
  ctx.lineWidth = 1.6
  ctx.stroke()

  const phase = (clock + offset) % 3.6 / 2.6
  if (found && phase < 1) {
    const lengths = bends.map((point, index) => {
      const from = points[index]!
      return Math.hypot(point.x - from.x, point.y - from.y)
    })
    let distance = phase * lengths.reduce((sum, length) => sum + length, 0)
    for (const [index, length] of lengths.entries()) {
      if (length > 0 && distance <= length) {
        const from = points[index]!
        const to = bends[index]!
        const x = from.x + (to.x - from.x) * distance / length
        const y = from.y + (to.y - from.y) * distance / length
        glow(ctx, x, y, 10, "#8EE8729E")
        disk(ctx, x, y, 2, lime)
        break
      }
      distance -= length
    }
  }
  ctx.restore()
}

type Footprint = Point & { angle: number; at: number }

export function createAgentDrawing() {
  let previousRun: Run | undefined
  let previous: Point = { x: 0, y: 0 }
  let previousTime = 0
  let facingAngle = 0
  let walkPhase = 0
  let nextPrint = 22
  let boot = 1
  let footprints: Footprint[] = []

  return {
    update(run: Run) {
      const { x, y, angle } = run.agent
      if (previousRun !== run) {
        previousRun = run
        previous = { x, y }
        previousTime = run.visualTime
        facingAngle = angle
        walkPhase = 0
        nextPrint = 22
        boot = 1
        footprints = []
      }

      const dx = x - previous.x
      const dy = y - previous.y
      const distance = Math.hypot(dx, dy)
      const delta = angle - facingAngle
      const dt = run.visualTime - previousTime
      facingAngle += Math.atan2(Math.sin(delta), Math.cos(delta)) * (1 - Math.exp(-18 * dt))
      if (distance > 0) {
        walkPhase = (walkPhase + distance * .17) % fullTurn
        while (nextPrint <= distance) {
          const progress = nextPrint / distance
          footprints.push({
            x: previous.x + dx * progress - Math.sin(facingAngle) * boot * 4,
            y: previous.y + dy * progress + Math.cos(facingAngle) * boot * 4,
            angle: facingAngle + boot * .15,
            at: run.visualTime,
          })
          nextPrint += 22
          boot *= -1
        }
        nextPrint -= distance
      }
      previous = { x, y }
      previousTime = run.visualTime
      footprints = footprints.filter(print => run.visualTime - print.at < 1.1)
      return distance > 0
    },
    paintFootprints(ctx: Canvas, time: number) {
      ctx.save()
      for (const print of footprints) {
        ctx.save()
        ctx.translate(print.x, print.y)
        ctx.rotate(print.angle)
        ctx.globalAlpha = .24 * (1 - (time - print.at) / 1.1)
        rounded(ctx, -3.7, -1.8, 6.5, 3.6, 1.4, "#BACCB5")
        ctx.fillStyle = graphite
        ctx.fillRect(-1.7, -.9, .8, 1.8)
        ctx.restore()
      }
      ctx.restore()
    },
    paintAgent(ctx: Canvas, run: Run, moving: boolean) {
      const { x, y } = run.agent
      const empFlash = run.wave && run.clock - run.wave.at < .45
      const bright = empFlash || run.focus >= 0
      const swing = moving ? Math.sin(walkPhase) * 2.5 : 0

      glow(ctx, x, y, agentRadius * (bright ? 2.9 : 2.4), bright ? "#8EE87255" : "#8EE87224")
      disk(ctx, x + 1.8, y + 3, agentRadius + 1, "rgba(0,0,0,0.48)")
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(facingAngle)
      ctx.lineWidth = 1.25
      rounded(ctx, -11, -4.5, 7, 9, 2.5, "#111914")
      ctx.strokeStyle = "#528052"
      ctx.stroke()
      rounded(ctx, -7 + swing, -9, 10, 4.3, 2, "#1D2B22")
      ctx.strokeStyle = lime
      ctx.stroke()
      rounded(ctx, -7 - swing, 4.7, 10, 4.3, 2, "#1D2B22")
      ctx.stroke()
      rounded(ctx, -7.8, -6, 14.5, 12, 4, "#1D2B22")
      ctx.stroke()
      disk(ctx, 2 + swing * .15, 0, 6.6, "#27382D")
      ctx.strokeStyle = "#527455"
      ctx.stroke()
      ctx.shadowColor = lime
      ctx.shadowBlur = bright ? 10 : 4
      rounded(ctx, 5.4, -4.1, 2.8, 8.2, 1.2, lime)
      ctx.fillStyle = "#ECFCE7"
      ctx.fillRect(6.2, -2.1, 1, 4.2)
      ctx.restore()
    },
    paintLamp(ctx: Canvas, { x, y }: Point) {
      const reach = 85
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(facingAngle)
      const light = ctx.createRadialGradient(5, 0, 3, 5, 0, reach - 5)
      light.addColorStop(0, "#8EE87200")
      light.addColorStop(.27, "rgba(142,232,114,0.10)")
      light.addColorStop(.66, "#8EE87212")
      light.addColorStop(1, "#8EE87200")
      ctx.fillStyle = light
      ctx.beginPath()
      ctx.moveTo(7, -3)
      ctx.quadraticCurveTo(45, -15, 82, -25)
      ctx.quadraticCurveTo(88, 0, 82, 25)
      ctx.quadraticCurveTo(45, 15, 7, 3)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    },
  }
}

export function paintSurveillance(ctx: Canvas, threat: Threat, drone: boolean, clock: number) {
  const { x, y, angle, disabledUntil } = threat
  const disabled = disabledUntil > clock
  const lamp = disabled ? lime : coral
  if (!drone) {
    disk(ctx, x + 2, y + 3, 8, "#0008")
    disk(ctx, x, y, 7, "#2B3A31")
    ctx.strokeStyle = "#66786A"
    ctx.lineWidth = 1
    ctx.stroke()
  }

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.globalAlpha = disabled ? .56 : 1
  if (drone) {
    ctx.strokeStyle = "#5A6F61"
    ctx.lineWidth = 3
    const rotorAngle = (disabled ? disabledUntil - empDuration : clock) * 24
    for (const [rotorX, rotorY] of [[-8, -8], [8, -8], [8, 8], [-8, 8]] as const) {
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(rotorX, rotorY)
      ctx.stroke()
      disk(ctx, rotorX, rotorY, 4.5, disabled ? "#19261F" : "#56756355")
      ctx.strokeStyle = "#70897999"
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(rotorX, rotorY, 3.4, rotorAngle + rotorX, rotorAngle + rotorX + 2.4)
      ctx.strokeStyle = disabled ? "#5F7569" : "#D3E6D899"
      ctx.stroke()
      ctx.strokeStyle = "#5A6F61"
      ctx.lineWidth = 3
    }
    rounded(ctx, -6.5, -5.8, 13, 11.6, 3, "#17251D")
    ctx.lineWidth = 1
    ctx.stroke()
    glow(ctx, 1.4, 0, 5.5, disabled ? "#8EE87244" : "#EF4444B3")
    disk(ctx, 1.4, 0, 2.5, lamp)
  } else {
    rounded(ctx, -8, -5.2, 17, 10.4, 2, "#1D2922")
    ctx.lineWidth = 1
    ctx.strokeStyle = "#91A397"
    ctx.stroke()
    glow(ctx, 9, 0, 16, disabled ? "#8EE87239" : "#EF444475")
    rounded(ctx, 7, -3.2, 4.2, 6.4, 1.1, "#090E0B")
    ctx.strokeStyle = lamp
    ctx.stroke()
    if (!disabled && Math.sin(clock * 7 + x * .05) > -.15) {
      glow(ctx, -4.5, -2.2, 4.6, "#EF4444A0")
      disk(ctx, -4.5, -2.2, 1.5, coral)
    }
  }
  ctx.restore()

  if (disabled) {
    const phase = (clock * 7 + x / 30) % 1
    if (phase < .53) {
      ctx.save()
      ctx.strokeStyle = "#8EE872AA"
      ctx.lineWidth = 1.4
      for (let index = 0; index < 2; index += 1) {
        const theta = Math.floor(clock * 7 + x / 30) * 2.4 + index * 2.7
        const px = x + Math.cos(theta) * 12
        const py = y + Math.sin(theta) * 12
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(px + 2, py - 3)
        ctx.lineTo(px + 4, py - 2)
        ctx.stroke()
      }
      ctx.restore()
    }
  }
}

export function paintFindingObject(ctx: Canvas, point: Point, kind: PuzzleKind, found: boolean, clock: number) {
  ctx.save()
  ctx.translate(point.x, point.y)
  ctx.globalAlpha = found ? .56 : 1
  rounded(ctx, -14, -9, 29, 22, 4, "#0206038C")
  if (kind === "sniffer") {
    ctx.strokeStyle = "#90AA94"
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(-9, 1)
    ctx.lineTo(-11, -9)
    ctx.moveTo(9, 1)
    ctx.lineTo(11, -9)
    ctx.stroke()
    rounded(ctx, -12, 0, 24, 11, 3, "#293D30")
    ctx.strokeStyle = "#719A79"
    ctx.stroke()
    disk(ctx, -6, 5, 1.2, lime)
    disk(ctx, -2, 5, 1.2, amber)
    for (let index = 0; index < 3; index += 1) {
      ctx.beginPath()
      ctx.arc(0, 0, 4 + index * 4, -2.25, -.89)
      ctx.strokeStyle = Math.floor(clock * 4) % 3 === index ? lime : "#8EE87255"
      ctx.stroke()
    }
  } else if (kind === "laptop") {
    rounded(ctx, -13, -9, 26, 23, 3, "#28382C")
    rounded(ctx, -10, -8, 20, 11, 2, "#17231C")
    glow(ctx, 0, -3, 10, "#F59E0B4D")
    rounded(ctx, -8.5, -7, 17, 8, 1, "#B77C27")
    ctx.fillStyle = "#FCE5AC"
    ctx.fillRect(-6, -4, 10, 1)
    rounded(ctx, -11, 3, 22, 9, 2, "#46584B")
    ctx.fillStyle = "#15201A"
    for (let col = -8; col <= 8; col += 4) {
      for (let row = 5; row < 10; row += 3) ctx.fillRect(col, row, 2, 1.4)
    }
  } else {
    rounded(ctx, -13, -9, 26, 17, 3, "#607265")
    rounded(ctx, -11, -7, 22, 12, 2, "#25392D")
    ctx.fillStyle = "#8EE87270"
    ctx.fillRect(-8, -4, 9, 1)
    ctx.fillRect(-8, -1, 6, 1)
    ctx.fillStyle = "#647B67"
    ctx.fillRect(-2, 8, 4, 4)
    rounded(ctx, -7, 11, 14, 2.5, 1, "#4C6551")
    ctx.save()
    ctx.translate(10, -2)
    ctx.rotate(.17)
    rounded(ctx, -3.5, -4, 7, 8, .7, "#FDE047")
    ctx.fillStyle = "#7A6019"
    ctx.fillRect(-2, -1, 4, .7)
    ctx.fillRect(-2, 1, 3, .7)
    ctx.restore()
  }
  ctx.globalAlpha = 1
  if (found) {
    disk(ctx, 11, -10, 8, "#10291B")
    ctx.strokeStyle = lime
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(7.5, -10)
    ctx.lineTo(10, -7.5)
    ctx.lineTo(14.8, -13)
    ctx.lineWidth = 2
    ctx.stroke()
  }
  ctx.restore()
}

export function paintFindingLight(ctx: Canvas, point: Point, kind: PuzzleKind, found: boolean) {
  glow(ctx, point.x, point.y, 45, found ? "#8EE87225" : targetLights[kind])
}

export function paintCore(ctx: Canvas, point: Point, unlocked: boolean, clock: number) {
  const scale = unlocked ? 1 + Math.sin(clock * 3) * .12 : .82
  ctx.save()
  ctx.translate(point.x, point.y)
  glow(ctx, 0, 0, unlocked ? 78 : 61, unlocked ? "#34D39955" : "#34D3992C")
  glow(ctx, 0, 0, unlocked ? 47 : 32, unlocked ? "#8EE87299" : "#8EE87246")
  glow(ctx, 0, 0, 17, "#FDE04728")
  ctx.strokeStyle = unlocked ? "#8EE872BB" : "#8EE87255"
  for (const radius of [17, 26]) {
    ctx.save()
    ctx.rotate(clock * (radius === 17 ? -.85 : .62))
    ctx.setLineDash(radius === 17 ? [6, 4] : [13, 4, 2, 4])
    ctx.lineWidth = radius === 17 ? 1.5 : 1
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, fullTurn)
    ctx.stroke()
    ctx.restore()
  }
  ctx.rotate(Math.PI / 4)
  ctx.shadowColor = lime
  ctx.shadowBlur = unlocked ? 17 : 5
  rounded(ctx, -7 * scale, -7 * scale, 14 * scale, 14 * scale, 2.2, unlocked ? lime : "#4F8057")
  rounded(ctx, -2.5, -2.5, 5, 5, .8, unlocked ? "#E9FDE1" : "#82A98A")
  ctx.restore()
}

export function paintGateHardware(ctx: Canvas, gate: Rect, unlocked: boolean, clock: number) {
  const x = gate.x + gate.w / 2
  ctx.save()
  if (!unlocked) {
    ctx.shadowColor = coral
    ctx.shadowBlur = 5
    ctx.strokeStyle = coral
    ctx.lineWidth = 1
    for (let index = -1; index <= 1; index += 1) {
      ctx.globalAlpha = .67 + Math.sin(clock * 12 + index * 1.3) * .24
      ctx.beginPath()
      ctx.moveTo(x + index * 3.5, gate.y + 3)
      ctx.lineTo(x + index * 3.5, gate.y + gate.h - 3)
      ctx.stroke()
    }
    const cycle = clock % 2.3
    if (cycle < .24) {
      const step = Math.floor(clock / 2.3)
      const edge = step % 2 === 0 ? gate.y : gate.y + gate.h
      ctx.globalAlpha = 1 - cycle / .24
      for (let index = 0; index < 3; index += 1) {
        const direction = step * 1.9 + index * 2.1
        disk(ctx, x + Math.cos(direction) * cycle * 41, edge + Math.sin(direction) * cycle * 52, 1, coral)
      }
    }
  }
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
  for (const end of [gate.y, gate.y + gate.h]) {
    glow(ctx, x, end, 24, unlocked ? "#8EE87247" : "#EF444478")
    rounded(ctx, x - 8, end - 3.5, 16, 7, 2, "#677B6D")
    rounded(ctx, x - 5.5, end - 1.7, 11, 3.4, 1, "#172820")
    disk(ctx, x, end, 1.4, unlocked ? lime : coral)
  }
  ctx.restore()
}

export function paintDesk(ctx: Canvas, { x, y, w, h }: Rect) {
  const center = x + w / 2
  const warm = (x + y) % 3 === 0
  glow(ctx, center, y + h / 2, Math.max(36, w * .72), warm ? "#F59E0B2E" : "#34D39923")
  rounded(ctx, x + 3, y + 4, w, h, 3, "#04090670")
  const top = ctx.createLinearGradient(x, y, x, y + h)
  top.addColorStop(0, "#29382F")
  top.addColorStop(1, "#18241C")
  ctx.fillStyle = top
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 3)
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = rim
  ctx.stroke()
  rounded(ctx, center - 11, y + 5, 22, 10, 2, "#3E5547")
  glow(ctx, center, y + 10, 20, warm ? "#F59E0B65" : "#34D39967")
  rounded(ctx, center - 9, y + 6, 18, 7, 1, warm ? "#F59E0B55" : "#34D39955")
  ctx.fillStyle = warm ? "#FDE047B2" : "#8EE872B2"
  ctx.fillRect(center - 7, y + 8, 8, 1)
  ctx.fillStyle = "#39483D"
  ctx.fillRect(center - 7, y + 18, 14, 4)
  rounded(ctx, center - 8, y + h - 2, 16, 11, 3, "#293D30")
  ctx.stroke()
  rounded(ctx, center - 9, y + h + 5, 18, 4, 2, "#486054")
}

export function paintPlants(ctx: Canvas) {
  for (const [x, y] of [[55, 300], [327, 477], [917, 245]] as const) {
    disk(ctx, x + 2, y + 3, 10, "#0009")
    disk(ctx, x, y, 7, "#39362B")
    ctx.save()
    ctx.translate(x, y)
    for (let leaf = 0; leaf < 5; leaf += 1) {
      ctx.rotate(fullTurn / 5)
      ctx.beginPath()
      ctx.ellipse(4, 0, 6, 2.6, .14, 0, fullTurn)
      ctx.fillStyle = leaf % 2 ? "#1E5B3A" : "#2E8555"
      ctx.fill()
    }
    ctx.restore()
  }
}

export function paintRack(ctx: Canvas, { x, y, w, h }: Rect) {
  ctx.save()
  rounded(ctx, x + 2.5, y + 3.5, w, h, 3, "#030705C9")
  rounded(ctx, x, y, w, h, 3, "#1C2A22")
  ctx.strokeStyle = rim
  ctx.lineWidth = 1
  ctx.stroke()
  rounded(ctx, x + 3, y + 3, w - 6, h - 6, 2, "#0D120F")
  ctx.strokeStyle = "#34D39922"
  for (let offset = 8; offset < h - 4; offset += 9) {
    ctx.beginPath()
    ctx.moveTo(x + 5, y + offset)
    ctx.lineTo(x + w - 12, y + offset)
    ctx.stroke()
  }
  ctx.restore()
}

export function paintRackLights(ctx: Canvas, racks: Rect[], clock: number) {
  ctx.save()
  racks.forEach(({ x, y, w, h }, index) => {
    for (let offset = 9; offset < h - 7; offset += 9) {
      const indicator = index * 1.7 + offset
      const rate = .66 + (offset % 5) * .23
      const slot = (index * 3 + offset / 9) % 13
      const color = slot === 7 ? coral : slot % 4 === 0 ? amber : lime
      const pulse = .5 + .5 * Math.sin(clock * rate + indicator)
      ctx.globalAlpha = slot === 7 ? .16 + .84 * pulse ** 6 : .44 + .56 * pulse
      ctx.shadowColor = color
      ctx.shadowBlur = 4
      ctx.fillStyle = color
      ctx.fillRect(x + w - 7, y + offset, 2, 2)
    }
  })
  ctx.restore()
}

export function paintPickups(ctx: Canvas, run: Run) {
  ctx.save()
  for (const item of pickups) {
    if (run.collected.includes(item.id)) continue
    const phase = run.clock * 3 + item.x * .1
    const color = item.id === "staff_badge" ? lime : amber
    const y = item.y + Math.sin(phase) * 2.5
    disk(ctx, item.x + 1, item.y + 3, 12, "#0007")
    glow(ctx, item.x, item.y, 23, item.id === "staff_badge" ? "#8EE87248" : "#F59E0B42")
    disk(ctx, item.x, item.y, 14 + Math.sin(phase) * 1.2, "#141C16C9")
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.save()
    ctx.translate(item.x, y)
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    if (item.id === "emp_cell") {
      rounded(ctx, -6, -7, 12, 15, 2.5, "#324033")
      ctx.stroke()
      ctx.fillStyle = color
      ctx.fillRect(-2.5, -9, 5, 2)
      ctx.beginPath()
      ctx.moveTo(1, -5)
      ctx.lineTo(-3, 1)
      ctx.lineTo(0, 1)
      ctx.lineTo(-1, 5)
      ctx.lineTo(3, -1)
      ctx.lineTo(0, -1)
      ctx.closePath()
      ctx.fill()
    } else if (item.id === "staff_badge") {
      rounded(ctx, -9, -6, 18, 12, 2.2, "#314533")
      ctx.stroke()
      disk(ctx, -4.6, -.9, 2, "#D0E7CC")
      rounded(ctx, -7, 1.5, 5, 2.5, 1, "#ACC3A8")
      ctx.fillStyle = lime
      ctx.fillRect(0, -2, 6, .8)
      ctx.fillRect(0, 1, 4, .8)
    } else {
      ctx.rotate(-.35)
      rounded(ctx, 2, -3.2, 7, 6.4, 1.2, "#B5C1B3")
      ctx.fillStyle = "#3F4A42"
      ctx.fillRect(6, -1.9, 1.5, 1)
      ctx.fillRect(6, .9, 1.5, 1)
      rounded(ctx, -8, -4.7, 13, 9.4, 2.5, "#354539")
      ctx.stroke()
      disk(ctx, -4, 0, 1.3, amber)
    }
    ctx.restore()

    if (Math.hypot(item.x - run.agent.x, item.y - run.agent.y) >= 95) continue
    const labelX = Math.max(83, Math.min(mapSize.width - 83, item.x))
    ctx.font = "bold 11px ui-monospace, Consolas, monospace"
    ctx.textAlign = "center"
    ctx.lineWidth = 3
    ctx.strokeStyle = "#080E0A"
    ctx.fillStyle = color
    ctx.strokeText(item.label, labelX, item.y + 27)
    ctx.fillText(item.label, labelX, item.y + 27)
  }
  ctx.restore()
}
