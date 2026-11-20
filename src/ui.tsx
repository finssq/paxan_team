import type { ComponentProps } from "react"

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div data-slot="card" className={`surface ${className}`} {...props} />
}

function sourceTokenKind(parts: string[], index: number, detailed: boolean) {
  const token = parts[index] ?? ""
  if (/^["'`]/.test(token)) return "string"
  if (/^(const|let|await|return|new)$/.test(token)) return "keyword"
  if (!detailed || (parts[index + 1] ?? "").trimStart().startsWith("(")) return "call"
  if (/^(?:\d|true$|false$|null$)/.test(token)) return "literal"
  if (/^(const|let)$/.test(parts[index - 2] ?? "")) return "declaration"
  if (/(?<!\.)\.$/.test(parts[index - 1] ?? "")) return "property"
  return "identifier"
}

export function CodeSource({ text, hidden, detailed = false }: { text: string; hidden?: boolean; detailed?: boolean }) {
  const parts = detailed
    ? text.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|[A-Za-z_$][\w$]*|\d+(?:\.\d+)?)/)
    : text.split(/("(?:[^"\\]|\\.)*"|\b(?:const|await)\b|\b[A-Za-z_$][\w$]*(?=\())/)
  return (
    <code aria-hidden={hidden}>
      {parts.map((part, index) => {
        if (index % 2 === 0) return part
        const kind = sourceTokenKind(parts, index, detailed)
        return <span className={`preview-token-${kind}`} key={index}>{part}</span>
      })}
    </code>
  )
}
