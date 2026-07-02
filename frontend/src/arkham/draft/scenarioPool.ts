import campaignJSON from '@/arkham/data/campaigns'
import scenarioJSON from '@/arkham/data/scenarios'
import type { Campaign, Scenario } from '@/arkham/data'

const EXCLUDED_CAMPAIGN_IDS = new Set(['09', '10', '11'])

export interface DraftScenarioOption {
  id: string
  name: string
  campaignId: string
  campaignName: string
}

function isStableStandaloneScenario(scenario: Scenario, campaign: Campaign | undefined): boolean {
  if (!campaign) return false
  if (!scenario.campaign) return false
  if (EXCLUDED_CAMPAIGN_IDS.has(scenario.campaign)) return false
  if (scenario.beta || scenario.alpha || scenario.dev) return false
  if (campaign.beta || campaign.alpha || campaign.dev) return false
  if (scenario.show === false || scenario.standalone === false) return false
  return true
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const campaigns = campaignJSON as Campaign[]
const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]))

export const draftScenarioPool: readonly DraftScenarioOption[] = (
  scenarioJSON as Scenario[]
).flatMap((scenario) => {
  const campaign = scenario.campaign ? campaignById.get(scenario.campaign) : undefined
  if (!isStableStandaloneScenario(scenario, campaign)) return []
  if (!campaign) return []

  return [
    {
      id: scenario.id,
      name: scenario.name,
      campaignId: campaign.id,
      campaignName: campaign.name,
    },
  ]
})

export function drawScenarioOptions(count = 3): DraftScenarioOption[] {
  return shuffle(draftScenarioPool).slice(0, count)
}
