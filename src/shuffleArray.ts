export function shuffleArray<T>(items: readonly T[], random = Math.random): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const value = shuffled[index]!
    shuffled[index] = shuffled[swap]!
    shuffled[swap] = value
  }
  return shuffled
}
