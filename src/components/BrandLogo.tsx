import { Terminal } from "lucide-react"

export function BrandLogo() {
  return (
    <span className="inline-flex shrink-0 items-center gap-[6px] text-[1.1rem] font-[850] whitespace-nowrap text-[#EFF7EF] max-[619px]:gap-1 max-[619px]:text-[.88rem]">
      <Terminal className="shrink-0 text-[#8EE872] max-[619px]:w-4" size={20} aria-hidden="true" />
      <span className="sr-only min-[381px]:not-sr-only">Work<span className="text-[#8EE872]">Lab</span></span>
    </span>
  )
}
