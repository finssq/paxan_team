export const playerNicknameLimit = 16

const storageKey = "worklab_player_nickname"
let temporaryNickname: string | undefined

function normalizeNickname(name: string) {
  return name.trim().slice(0, playerNicknameLimit).trimEnd()
}

export function getPlayerNickname(): string {
  if (temporaryNickname !== undefined) return temporaryNickname
  try {
    return normalizeNickname(localStorage.getItem(storageKey) ?? "")
  } catch {
    return ""
  }
}

export function setPlayerNickname(name: string): void {
  const nickname = normalizeNickname(name)
  try {
    localStorage.setItem(storageKey, nickname)
    temporaryNickname = undefined
  } catch {
    temporaryNickname = nickname
  }
}
