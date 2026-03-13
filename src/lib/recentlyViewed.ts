const MAX_RECENT = 8
const RECENT_KEY = 'labmate_recent'

export function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  } catch { return [] }
}

export function addRecent(externalId: string) {
  const list = getRecent().filter(id => id !== externalId)
  list.unshift(externalId)
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)))
}
