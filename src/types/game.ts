import { z } from "zod"

const nonempty = z.string().trim().min(1)
const messages = z.object({ security: nonempty, feature: nonempty })
const outcome = z.enum(["breaks_feature", "still_vulnerable", "fixed"])

const codeLine = z.object({
  id: nonempty,
  text: nonempty,
  humanHint: nonempty,
  isVulnerable: z.boolean(),
})

const repair = z.object({
  id: nonempty,
  label: nonempty,
  outcome,
  checks: messages,
})

const update = z.object({
  id: nonempty,
  title: nonempty,
  developer: nonempty,
  mentor: nonempty,
  code: z.array(codeLine).min(7).max(10),
  sandbox: z.object({
    kind: z.enum(["inspector", "url-bar", "ai-chat", "package-registry"]),
    title: nonempty,
    detail: nonempty,
    tool: nonempty,
    initial: messages,
  }),
  repair: z.object({
    kind: z.enum(["drag-to-vault", "patch-blocks", "security-toggles", "none"]),
    options: z.array(repair).max(3),
  }),
})

export const chapterSchema = z.object({
  id: nonempty,
  title: nonempty,
  description: nonempty,
  updates: z.array(update).min(1),
}).superRefine(({ updates }, context) => {
  const require = (valid: boolean, message: string, path: (string | number)[]) => {
    if (!valid) context.addIssue({ code: "custom", message, path })
  }
  const unique = (items: { id: string }[]) => new Set(items.map(item => item.id)).size === items.length

  require(unique(updates), "Update IDs must be unique", ["updates"])
  for (const [index, item] of updates.entries()) {
    const path = ["updates", index]
    const clean = item.repair.kind === "none"
    const vulnerableLines = item.code.filter(line => line.isVulnerable).length
    const options = item.repair.options

    require(unique(item.code), "Line IDs must be unique", [...path, "code"])
    require(vulnerableLines === Number(!clean), "Expected one cause for a vulnerable update", [...path, "code"])
    require(unique(options), "Repair IDs must be unique", [...path, "repair"])
    require(clean ? options.length === 0 : options.length >= 2 && options.filter(option => option.outcome === "fixed").length === 1,
      "Expected exactly one working repair for a vulnerable update", [...path, "repair"])
  }
})

export const saveSchema = z.object({
  version: z.literal(1),
  chapterId: nonempty,
  updateId: nonempty,
  step: z.enum(["explore", "locate", "patch", "retest", "stamp", "complete"]),
  lineId: z.string().nullable(),
  repairId: z.string().nullable(),
  testedRepairId: z.string().nullable(),
  failedRetests: z.number().int().nonnegative(),
})

export type Chapter = z.infer<typeof chapterSchema>
export type Update = z.infer<typeof update>
export type CheckMessages = z.infer<typeof messages>
export type RepairOutcome = z.infer<typeof outcome>
export type Checks = Record<keyof CheckMessages, { passed: boolean; message: string }>
export type GameState = z.infer<typeof saveSchema>
