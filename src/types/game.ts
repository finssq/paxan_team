export type CheckResult = { ok: boolean; detail: string }

export type ReviewChecks = {
  security: CheckResult
  feature: CheckResult
}

export type CodeLine = { id: string; text: string; hint: string }

export type RepairOption = {
  id: string
  title: string
  detail: string
  changes: CodeLine[]
  checks: ReviewChecks
}

export type Ticket = {
  id: string
  title: string
  time: string
  file: string
  developer: string
  hint: string
  summary: string
  preview: { title: string; reference: string; amount: string }
  lines: CodeLine[]
  evidenceLineId: string | null
  initialChecks: ReviewChecks
  patches: RepairOption[]
}

export type Chapter = { title: string; tickets: Ticket[]; upcoming: string[] }
