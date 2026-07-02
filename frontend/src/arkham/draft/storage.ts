import type { ArkhamDbDecklist } from '@/arkham/types/Deck'
import { ZOEY_INVESTIGATOR_CODE } from '@/arkham/draft/zoeyMockPackets'

const DRAFT_MOCK_DECKLIST_PREFIX = 'draftMockDecklist:'
const DRAFT_MOCK_SETUP_PREFIX = 'draftMockSetup:'

export interface DraftMockSetupState {
  autoResolveStandaloneSettings: boolean
  standaloneSetupSummary: string[]
}

export function draftMockDecklistStorageKey(gameId: string): string {
  return `${DRAFT_MOCK_DECKLIST_PREFIX}${gameId}`
}

export function draftMockSetupStorageKey(gameId: string): string {
  return `${DRAFT_MOCK_SETUP_PREFIX}${gameId}`
}

export function saveDraftMockDecklist(gameId: string, decklist: ArkhamDbDecklist): void {
  sessionStorage.setItem(draftMockDecklistStorageKey(gameId), JSON.stringify(decklist))
}

export function clearDraftMockDecklist(gameId: string): void {
  sessionStorage.removeItem(draftMockDecklistStorageKey(gameId))
}

export function saveDraftMockSetupState(gameId: string, state: DraftMockSetupState): void {
  sessionStorage.setItem(draftMockSetupStorageKey(gameId), JSON.stringify(state))
}

export function clearDraftMockSetupState(gameId: string): void {
  sessionStorage.removeItem(draftMockSetupStorageKey(gameId))
}

export function loadDraftMockSetupState(gameId: string): DraftMockSetupState | null {
  const raw = sessionStorage.getItem(draftMockSetupStorageKey(gameId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isDraftMockSetupState(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function updateDraftMockSetupSummary(gameId: string, summary: string[]): void {
  const current = loadDraftMockSetupState(gameId)
  if (!current) return

  saveDraftMockSetupState(gameId, {
    ...current,
    standaloneSetupSummary: summary,
  })
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
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

function isDraftMockSetupState(value: unknown): value is DraftMockSetupState {
  if (!isRecord(value)) return false
  return value.autoResolveStandaloneSettings === true && isStringArray(value.standaloneSetupSummary)
}
