<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { newGame as createGame } from '@/arkham/api'
import { useCardStore } from '@/stores/cards'
import { cardImage } from '@/arkham/cardImages'
import { imgsrc } from '@/arkham/helpers'
import type { CardDef } from '@/arkham/types/CardDef'
import { buildZoeyDraftDecklist, countDraftCards } from '@/arkham/draft/buildDraftDecklist'
import { drawScenarioOptions, type DraftScenarioOption } from '@/arkham/draft/scenarioPool'
import { saveDraftMockDecklist, saveDraftMockSetupState } from '@/arkham/draft/storage'
import {
  DRAFT_CARDS_PER_PACKET,
  DRAFT_CARD_COPY_LIMIT,
  DRAFT_ROUNDS,
  type DraftPacket,
  type DraftPick,
} from '@/arkham/draft/types'
import { roundPacketPreferences, zoeyMockPackets } from '@/arkham/draft/zoeyMockPackets'

const router = useRouter()
const cardStore = useCardStore()
const scenarioOptions = ref<DraftScenarioOption[]>(drawScenarioOptions())
const selectedScenario = ref<DraftScenarioOption | null>(null)
const picks = ref<DraftPick[]>([])
const error = ref<string | null>(null)
const starting = ref(false)

cardStore.fetchCards()

const cardMap = computed(() => {
  const result = new Map<string, CardDef>()
  for (const card of cardStore.cards) {
    result.set(card.cardCode.replace(/^c/, ''), card)
    result.set(card.art.replace(/^c/, ''), card)
  }
  return result
})

const currentRoundIndex = computed(() => picks.value.length)
const currentRound = computed(() => Math.min(currentRoundIndex.value + 1, DRAFT_ROUNDS))
const isComplete = computed(() => picks.value.length >= DRAFT_ROUNDS)
const hasSelectedScenario = computed(() => selectedScenario.value !== null)
const selectedScenarioName = computed(() => selectedScenario.value?.name ?? 'Choose a scenario')
const selectedCampaignName = computed(
  () => selectedScenario.value?.campaignName ?? 'Scenario draft',
)
const draftCounts = computed(() => countDraftCards(picks.value))
const draftedCardTotal = computed(() =>
  Object.values(draftCounts.value).reduce((total, count) => total + count, 0),
)
const selectedPacketIds = computed(() => new Set(picks.value.map((pick) => pick.packetId)))
const selectedPackets = computed(() =>
  picks.value.flatMap((pick) => {
    const packet = zoeyMockPackets.find((entry) => entry.id === pick.packetId)
    return packet ? [packet] : []
  }),
)

const categoryCounts = computed(() => {
  const result = new Map<string, number>()
  for (const packet of selectedPackets.value) {
    result.set(packet.type, (result.get(packet.type) ?? 0) + packet.cards.length)
  }
  return [...result.entries()].sort(([a], [b]) => a.localeCompare(b))
})

const groupedDraftCards = computed(() =>
  Object.entries(draftCounts.value)
    .map(([code, count]) => ({ code, count, name: cardName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name)),
)

const legalPackets = computed(() =>
  zoeyMockPackets.filter(
    (packet) => !selectedPacketIds.value.has(packet.id) && isPacketLegal(packet),
  ),
)

const currentPackets = computed(() => {
  if (isComplete.value) return []

  const preferences = roundPacketPreferences[currentRoundIndex.value] ?? []
  const preferred = legalPackets.value.filter((packet) => preferences.includes(packet.type))
  const preferredIds = new Set(preferred.map((packet) => packet.id))
  const fallback = legalPackets.value.filter((packet) => !preferredIds.has(packet.id))

  return [...preferred, ...fallback].slice(0, 3)
})

const canStart = computed(
  () =>
    !starting.value &&
    selectedScenario.value !== null &&
    picks.value.length === DRAFT_ROUNDS &&
    draftedCardTotal.value === DRAFT_ROUNDS * DRAFT_CARDS_PER_PACKET,
)

function cardDef(code: string): CardDef | undefined {
  return cardMap.value.get(code.replace(/^c/, ''))
}

function cardName(code: string): string {
  const card = cardDef(code)
  if (!card) return code
  const subtitle = card.name.subtitle === null ? '' : `: ${card.name.subtitle}`
  return `${card.name.title}${subtitle}`
}

function isPacketLegal(packet: DraftPacket): boolean {
  const nextCounts = { ...draftCounts.value }

  for (const code of packet.cards) {
    nextCounts[code] = (nextCounts[code] ?? 0) + 1
    if (nextCounts[code] > DRAFT_CARD_COPY_LIMIT) return false
  }

  return true
}

function selectPacket(packet: DraftPacket) {
  if (!selectedScenario.value) return
  if (isComplete.value) return
  if (!isPacketLegal(packet)) {
    error.value = 'That packet would exceed the two-copy deck limit.'
    return
  }

  error.value = null
  picks.value = [
    ...picks.value,
    {
      round: currentRound.value,
      packetId: packet.id,
      cards: packet.cards,
    },
  ]
}

function selectScenario(scenario: DraftScenarioOption) {
  selectedScenario.value = scenario
  error.value = null
}

function undoLastPick() {
  error.value = null
  picks.value = picks.value.slice(0, -1)
}

function restartDraft() {
  error.value = null
  selectedScenario.value = null
  scenarioOptions.value = drawScenarioOptions()
  picks.value = []
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 'Unable to start the draft mock game.'
}

async function startStandalone() {
  const scenario = selectedScenario.value
  if (!canStart.value || !scenario) return

  starting.value = true
  error.value = null

  try {
    const decklist = buildZoeyDraftDecklist(picks.value, scenario.name)
    const game = await createGame(
      [null],
      1,
      null,
      scenario.id,
      'Easy',
      `Draft Mock - ${scenario.name}`,
      'WithFriends',
      false,
      [],
    )

    saveDraftMockDecklist(game.id, decklist)
    saveDraftMockSetupState(game.id, {
      autoResolveStandaloneSettings: true,
      standaloneSetupSummary: [],
    })
    await router.push(`/games/${game.id}`)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    starting.value = false
  }
}
</script>

<template>
  <div class="page-container draft-page">
    <main class="draft-shell page-content">
      <header class="draft-header">
        <div>
          <h1>Draft Mode Mock</h1>
          <p>Zoey Samaras / {{ selectedScenarioName }} / 10 packet draft</p>
        </div>
        <button class="ghost-button" type="button" @click="router.push('/')">Back</button>
      </header>

      <div class="draft-layout">
        <section class="draft-main" aria-live="polite">
          <div class="round-panel">
            <div class="round-copy">
              <span class="round-label" v-if="!hasSelectedScenario">Scenario draft</span>
              <span class="round-label" v-else>Round {{ currentRound }} / {{ DRAFT_ROUNDS }}</span>
              <h2 v-if="!hasSelectedScenario">Choose one scenario</h2>
              <h2 v-else-if="!isComplete">Choose one packet</h2>
              <h2 v-else>Draft complete</h2>
              <p v-if="!hasSelectedScenario">
                Pick the standalone scenario for this Zoey draft run.
              </p>
              <p v-else-if="!isComplete">
                Pick one packet. All three cards are added to the draft deck.
              </p>
              <p v-else>Your 30-card Zoey draft is ready for {{ selectedScenarioName }}.</p>
            </div>
            <div class="draft-total">
              <strong>{{ draftedCardTotal }}</strong>
              <span>/ 30 drafted cards</span>
            </div>
          </div>

          <div v-if="error" class="error-state">{{ error }}</div>

          <div v-if="!hasSelectedScenario" class="scenario-grid">
            <button
              v-for="scenario in scenarioOptions"
              :key="scenario.id"
              class="scenario-card"
              type="button"
              @click="selectScenario(scenario)"
            >
              <img :src="imgsrc(`boxes/${scenario.id}.jpg`)" :alt="scenario.name" />
              <span class="packet-source">{{ scenario.campaignName }}</span>
              <h3>{{ scenario.name }}</h3>
              <small>{{ scenario.id }}</small>
            </button>
          </div>

          <div v-else-if="!isComplete && currentPackets.length > 0" class="packet-grid">
            <button
              v-for="packet in currentPackets"
              :key="packet.id"
              class="packet-card"
              type="button"
              @click="selectPacket(packet)"
            >
              <span class="packet-source">{{ packet.source }}</span>
              <span class="packet-type">{{ packet.type }}</span>
              <h3>{{ packet.label ?? packet.type }}</h3>
              <p v-if="packet.description">{{ packet.description }}</p>

              <ul class="packet-cards">
                <li v-for="code in packet.cards" :key="code">
                  <img :src="cardImage(code)" :alt="cardName(code)" />
                  <span>
                    <strong>{{ cardName(code) }}</strong>
                    <small>{{ code }}</small>
                  </span>
                </li>
              </ul>
            </button>
          </div>

          <div v-else-if="!isComplete" class="empty-state">
            No legal packets remain for this draft state. Undo the last pick or restart.
          </div>

          <div v-else class="complete-state">
            <p>
              The actual decklist will also include Zoey's Cross, Smite the Wicked, and one random
              basic weakness placeholder for game compatibility.
            </p>
          </div>
        </section>

        <aside class="draft-summary" aria-label="Draft summary">
          <div class="summary-header">
            <h2>Draft Deck</h2>
            <span>{{ picks.length }} picks</span>
          </div>

          <div class="summary-actions">
            <button type="button" @click="undoLastPick" :disabled="picks.length === 0 || starting">
              Undo last pick
            </button>
            <button
              type="button"
              @click="restartDraft"
              :disabled="(!hasSelectedScenario && picks.length === 0) || starting"
            >
              Restart draft
            </button>
            <button
              class="start-button"
              type="button"
              @click="startStandalone"
              :disabled="!canStart"
            >
              {{ starting ? 'Starting...' : 'Start Standalone' }}
            </button>
          </div>

          <section class="summary-section first">
            <h3>Scenario</h3>
            <p class="selected-scenario">{{ selectedScenarioName }}</p>
            <p class="muted">{{ selectedCampaignName }}</p>
          </section>

          <section class="summary-section">
            <h3>Category Counts</h3>
            <dl v-if="categoryCounts.length > 0" class="category-list">
              <template v-for="[category, count] in categoryCounts" :key="category">
                <dt>{{ category }}</dt>
                <dd>{{ count }}</dd>
              </template>
            </dl>
            <p v-else class="muted">No packets selected yet.</p>
          </section>

          <section class="summary-section">
            <h3>Cards</h3>
            <ul v-if="groupedDraftCards.length > 0" class="deck-list">
              <li v-for="entry in groupedDraftCards" :key="entry.code">
                <span>{{ entry.name }}</span>
                <strong>x{{ entry.count }}</strong>
              </li>
            </ul>
            <p v-else class="muted">Drafted cards will appear here.</p>
          </section>
        </aside>
      </div>
    </main>
  </div>
</template>

<style scoped>
.draft-page {
  min-height: 100vh;
}

.draft-shell {
  width: min(1220px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 24px 0 40px;
}

.draft-header,
.round-panel,
.summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.draft-header {
  margin-bottom: 20px;
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1,
h2 {
  color: var(--title);
  font-family: teutonic, sans-serif;
  text-transform: uppercase;
}

h1 {
  font-size: 2.3rem;
}

.draft-header p,
.round-copy p,
.complete-state,
.muted {
  color: var(--text);
}

.draft-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 18px;
  align-items: start;
}

.draft-main,
.draft-summary {
  background: var(--box-background);
  border: 1px solid var(--box-border);
  border-radius: 6px;
}

.draft-main {
  padding: 18px;
}

.draft-summary {
  position: sticky;
  top: 16px;
  padding: 16px;
}

.round-panel {
  margin-bottom: 16px;
}

.round-label,
.packet-source,
.packet-type {
  display: inline-flex;
  width: fit-content;
  color: white;
  background: var(--guardian);
  border-radius: 3px;
  padding: 3px 8px;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}

.draft-total {
  display: grid;
  justify-items: end;
  color: var(--text);
}

.draft-total strong {
  color: var(--title);
  font-size: 2rem;
  line-height: 1;
}

.packet-grid,
.scenario-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.packet-card,
.scenario-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 100%;
  padding: 14px;
  color: var(--text);
  text-align: left;
  background: var(--background);
  border: 1px solid var(--box-border);
  border-radius: 6px;
  cursor: pointer;
}

.packet-card:hover,
.scenario-card:hover {
  border-color: var(--guardian);
  background: color-mix(in srgb, var(--guardian) 15%, var(--background));
}

.packet-card h3,
.scenario-card h3 {
  color: var(--title);
  font-size: 1.15rem;
}

.scenario-card img {
  width: 100%;
  aspect-ratio: 7 / 5;
  object-fit: cover;
  border-radius: 4px;
}

.scenario-card small {
  color: var(--text);
  opacity: 0.8;
}

.packet-type {
  background: var(--spooky-green);
}

.packet-cards,
.deck-list {
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.packet-cards li {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.packet-cards img {
  width: 44px;
  aspect-ratio: 5 / 7;
  object-fit: cover;
  border-radius: 3px;
}

.packet-cards span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.packet-cards strong,
.deck-list span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.packet-cards small {
  color: var(--text);
  opacity: 0.8;
}

.summary-header {
  margin-bottom: 12px;
}

.summary-header h2 {
  font-size: 1.45rem;
}

.summary-header span {
  color: var(--text);
}

.summary-actions {
  display: grid;
  gap: 8px;
  margin-bottom: 18px;
}

button {
  border: 0;
  border-radius: 4px;
  padding: 9px 12px;
  font-weight: 700;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.summary-actions button,
.ghost-button {
  color: white;
  background: var(--spooky-green);
}

.summary-actions button:hover:not(:disabled),
.ghost-button:hover {
  filter: brightness(1.08);
}

.start-button {
  background: var(--guardian) !important;
}

.summary-section {
  border-top: 1px solid var(--box-border);
  padding-top: 14px;
  margin-top: 14px;
}

.summary-section.first {
  border-top: 0;
  padding-top: 0;
  margin-top: 0;
}

.summary-section h3 {
  color: var(--title);
  margin-bottom: 10px;
}

.category-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px 10px;
  margin: 0;
  color: var(--text);
}

.category-list dt,
.category-list dd {
  margin: 0;
}

.category-list dd {
  font-weight: 700;
}

.deck-list {
  max-height: 360px;
  overflow: auto;
}

.deck-list li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--text);
}

.deck-list strong {
  color: var(--title);
}

.selected-scenario {
  color: var(--title);
  font-weight: 700;
}

.error-state,
.empty-state,
.complete-state {
  margin-bottom: 14px;
  padding: 12px;
  border-radius: 6px;
}

.error-state {
  color: white;
  background: var(--survivor);
}

.empty-state,
.complete-state {
  color: var(--text);
  background: var(--background);
  border: 1px solid var(--box-border);
}

@media (max-width: 900px) {
  .draft-layout,
  .packet-grid,
  .scenario-grid {
    grid-template-columns: 1fr;
  }

  .draft-summary {
    position: static;
  }
}
</style>
