export const DRAFT_ROUNDS = 10
export const DRAFT_CARDS_PER_PACKET = 3
export const DRAFT_CARD_COPY_LIMIT = 2

export type DraftPacketType =
  | 'Weapon Core'
  | 'Combat Burst'
  | 'Economy'
  | 'Soak/Defense'
  | 'Engage/Protect'
  | 'Clue Utility'
  | 'Will Defense'
  | 'Flex'

export interface DraftPacket {
  id: string
  source: string
  type: DraftPacketType
  cards: readonly [string, string, string]
  label?: string
  description?: string
}

export interface DraftPick {
  round: number
  packetId: string
  cards: readonly [string, string, string]
}
