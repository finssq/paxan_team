import { Pencil, User } from "lucide-react"
import { useId, useRef } from "react"
import { playerNicknameLimit } from "../utils/playerProfile"

const nicknameMotion = `
  @keyframes wl-nickname-shimmer {
    0% { transform: translateX(-180%) skewX(-20deg); }
    45%, 100% { transform: translateX(440%) skewX(-20deg); }
  }
  @keyframes wl-nickname-border {
    0%, 100% { border-color: rgb(142 232 114 / .40); }
    50% { border-color: rgb(142 232 114 / .60); }
  }
  @keyframes wl-nickname-edit {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1px); }
  }
  @keyframes wl-nickname-caret {
    0%, 45%, 100% { opacity: 1; }
    65%, 80% { opacity: .25; }
  }
`

export function PlayerNicknameField({ placeholder, value, onChange, hint }: {
  placeholder: string; value: string; onChange: (value: string) => void; hint?: string
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const hintId = `${id}-hint`

  return (
    <div className="grid w-full max-w-xs gap-1 self-start text-left text-xs font-bold text-[#DEE8DE]">
      <style>{nicknameMotion}</style>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id}>Никнейм</label>
        {hint && <span id={hintId} className="text-[11px] font-medium text-[#9DADA0]">{hint}</span>}
      </div>
      <div className="group relative flex min-h-9 min-w-0 items-center gap-2 overflow-hidden rounded-xl border border-[#8EE872]/40 bg-white/[0.05] px-2 transition-all hover:bg-white/[0.08] focus-within:border-[#8EE872] focus-within:ring-2 focus-within:ring-[#8EE872]/25 motion-safe:not-focus-within:animate-[wl-nickname-border_3.2s_ease-in-out_infinite]">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-[34%] bg-linear-to-r from-transparent via-[#8EE872]/10 to-transparent opacity-0 motion-safe:group-not-focus-within:animate-[wl-nickname-shimmer_3.2s_ease-in-out_infinite] motion-safe:group-not-focus-within:opacity-100" />
        <User size={15} className="pointer-events-none relative shrink-0 text-[#8EE872]" aria-hidden="true" />
        <input id={id} ref={input} type="text" maxLength={playerNicknameLimit} autoComplete="nickname" placeholder={placeholder}
          aria-describedby={hint ? hintId : undefined} value={value} onChange={event => onChange(event.currentTarget.value)}
          className="relative min-w-0 flex-1 bg-transparent py-1.5 text-base font-medium text-white caret-[#8EE872] placeholder:text-[#8E9F92] focus:outline-none sm:text-sm" />
        <button type="button" aria-controls={id} onClick={() => {
          input.current?.focus()
          input.current?.select()
        }} className="relative inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-[#8EE872]/25 bg-[#8EE872]/10 px-1.5 py-0.5 text-[11px] font-bold text-[#BDF4AD] hover:bg-[#8EE872]/20 focus-visible:outline-1 focus-visible:outline-[#8EE872] motion-safe:group-not-focus-within:animate-[wl-nickname-edit_3.2s_ease-in-out_infinite]">
          <span className="font-mono text-[#8EE872] motion-safe:group-not-focus-within:animate-[wl-nickname-caret_1.35s_ease-in-out_infinite]" aria-hidden="true">|</span>
          <Pencil size={12} aria-hidden="true" /> Изменить
        </button>
      </div>
    </div>
  )
}
