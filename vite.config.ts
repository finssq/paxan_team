import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import chapter from "./src/data/chapter1.json" with { type: "json" }
import { chapterSchema } from "./src/types/game.ts"

chapterSchema.parse(chapter)

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
})
