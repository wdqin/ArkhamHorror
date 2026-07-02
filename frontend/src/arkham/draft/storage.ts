import type { ArkhamDbDecklist } from '@/arkham/types/Deck'
import { ZOEY_INVESTIGATOR_CODE } from '@/arkham/draft/zoeyMockPackets'

const DRAFT_MOCK_DECKLIST_PREFIX = 'draftMockDecklist:'

export function draftMockDecklistStorageKey(gameId: string): string {
  return `${DRAFT_MOCK_DECKLIST_PREFIX}${gameId}`
}

export function saveDraftMockDecklist(gameId: string, decklist: ArkhamDbDecklist): void {
  sessionStorage.setItem(draftMockDecklistStorageKey(gameId), JSON.stringify(decklist))
}

export function clearDraftMockDecklist(gameId: string): void {
  sessionStorage.removeItem(draftMockDecklistStorageKey(gameId))
}

export function loadDraftMockDecklist(gameId: string): ArkhamDbDecklist | null {
  const raw = sessionStorage.getItem(draftMockDecklistStorageKey(gameId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isDraftMockDecklist(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSlotRecord(value: unknown): value is Record<string, number> {
  if (!isRecord(value)) return false
  return Object.values(value).every((count) => typeof count === 'number' && Number.isFinite(count))
}

function isDraftMockDecklist(value: unknown): value is ArkhamDbDecklist {
  if (!isRecord(value)) return false
  return (
    value.investigator_code === ZOEY_INVESTIGATOR_CODE &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.investigator_name === 'string' &&
    (typeof value.url === 'string' || value.url === null) &&
    isSlotRecord(value.slots)
  )
}
