import type { ArkhamDbDecklist } from '@/arkham/types/Deck'
import type { DraftPick } from '@/arkham/draft/types'
import {
  RANDOM_BASIC_WEAKNESS_CODE,
  ZOEY_INVESTIGATOR_CODE,
  ZOEY_INVESTIGATOR_NAME,
  ZOEY_SIGNATURE_CODE,
  ZOEY_SIGNATURE_WEAKNESS_CODE,
} from '@/arkham/draft/zoeyMockPackets'

export function countDraftCards(picks: readonly DraftPick[]): Record<string, number> {
  const slots: Record<string, number> = {}

  for (const pick of picks) {
    for (const code of pick.cards) {
      slots[code] = (slots[code] ?? 0) + 1
    }
  }

  return slots
}

export function buildZoeyDraftDecklist(
  picks: readonly DraftPick[],
  scenarioName: string,
): ArkhamDbDecklist {
  const slots = countDraftCards(picks)
  slots[ZOEY_SIGNATURE_CODE] = (slots[ZOEY_SIGNATURE_CODE] ?? 0) + 1
  slots[ZOEY_SIGNATURE_WEAKNESS_CODE] = (slots[ZOEY_SIGNATURE_WEAKNESS_CODE] ?? 0) + 1
  slots[RANDOM_BASIC_WEAKNESS_CODE] = (slots[RANDOM_BASIC_WEAKNESS_CODE] ?? 0) + 1

  return {
    id: `draft-mock-zoey-${Date.now()}`,
    url: null,
    name: `Draft Zoey - ${scenarioName}`,
    investigator_code: ZOEY_INVESTIGATOR_CODE,
    investigator_name: ZOEY_INVESTIGATOR_NAME,
    slots,
  }
}
