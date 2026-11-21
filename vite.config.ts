import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import chapter from "./src/data/chapter1.json" with { type: "json" }
import { fridayChapter } from "./src/data/friday.ts"
import { validateChapter } from "./src/game/review.ts"

validateChapter(chapter)
validateChapter(fridayChapter)

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
})
