import { friday, incidentPackets } from "../data/friday.ts"

export type WaveRun = {
  started: boolean; remainingMs: number; captured: string[]; rosterSeen: boolean
  score: number; combo: number; credited: string[]; xrayCharges: number; freezeCharges: number; xrayMs: number; freezeMs: number
}

export const initialWave: WaveRun = {
  started: false, remainingMs: friday.durationMs, captured: [], rosterSeen: false,
  score: 0, combo: 1, credited: [], xrayCharges: friday.charges, freezeCharges: friday.charges, xrayMs: 0, freezeMs: 0,
}

function numberInRange(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback
}

export function readWave(value: unknown): WaveRun | undefined {
  if (!value || typeof value !== "object" || !("started" in value) || value.started !== true ||
    !("remainingMs" in value) || typeof value.remainingMs !== "number" || !Number.isInteger(value.remainingMs) ||
    value.remainingMs < 0 || value.remainingMs > friday.durationMs || !("captured" in value) || !Array.isArray(value.captured)) return undefined
  const fields = value as Record<string, unknown>
  const captured = incidentPackets.filter(packet => (fields.captured as unknown[]).includes(packet.id)).map(packet => packet.id)
  const credited = Array.isArray(fields.credited) ? fields.credited : captured
  return { started: true, remainingMs: value.remainingMs, captured, rosterSeen: fields.rosterSeen === true,
    credited: incidentPackets.filter(packet => credited.includes(packet.id)).map(packet => packet.id),
    score: numberInRange(fields.score, 0, 100_000, 0), combo: numberInRange(fields.combo, 1, 3, 1),
    xrayCharges: numberInRange(fields.xrayCharges, 0, friday.charges, friday.charges), freezeCharges: numberInRange(fields.freezeCharges, 0, friday.charges, friday.charges),
    xrayMs: numberInRange(fields.xrayMs, 0, friday.xrayMs, 0), freezeMs: numberInRange(fields.freezeMs, 0, friday.freezeMs, 0) }
}
