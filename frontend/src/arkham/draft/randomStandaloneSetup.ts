import type {
  PartnerStatus,
  SettingCondition,
  StandaloneSetting,
} from '@/arkham/types/StandaloneSetting'

export interface DraftStandaloneSetupResult {
  settings: StandaloneSetting[]
  summary: string[]
}

const PARTNER_CODES = [
  '08720',
  '08714',
  '08715',
  '08721',
  '08722',
  '08718',
  '08717',
  '08719',
  '08716',
]

const PARTNER_STATUSES: PartnerStatus[] = ['Safe', 'Resolute', 'Eliminated']

function randomBool(): boolean {
  return Math.random() < 0.5
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomItem<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)]
}

function cloneSettings(settings: readonly StandaloneSetting[]): StandaloneSetting[] {
  return JSON.parse(JSON.stringify(settings)) as StandaloneSetting[]
}

function flattenSettings(settings: readonly StandaloneSetting[]): StandaloneSetting[] {
  return settings.flatMap((setting) =>
    setting.type === 'Group' ? flattenSettings(setting.content) : [setting],
  )
}

function isInactive(cond: SettingCondition, settings: readonly StandaloneSetting[]): boolean {
  const flatSettings = flattenSettings(settings)
  const findSetting = (key: string) => flatSettings.find((setting) => setting.key === key)

  if (cond.type === 'inSet') {
    const setting = findSetting(cond.key)
    if (!setting) return false

    const check = setting.key !== 'ToggleCrossedOut'

    if (setting.type === 'ToggleCrossedOut') {
      return setting.content.some((entry) => entry.content === check && entry.key === cond.content)
    }

    if (setting.type === 'ToggleRecords') {
      return !setting.content.some((entry) => entry.content && entry.key === cond.content)
    }

    return false
  }

  if (cond.type === 'not') return !isInactive(cond.content, settings)
  if (cond.type === 'or') return !cond.content.some((entry) => !isInactive(entry, settings))

  if (cond.type === 'option') {
    const setting = findSetting(cond.key)
    if (!setting || setting.type !== 'ToggleOption') return false
    return !setting.content
  }

  if (cond.type === 'survivedPlaneCrash') {
    const setting = findSetting('KilledInPlaneCrash')
    if (!setting || setting.type !== 'SetPartnerKilled') return false
    return setting.content === cond.key
  }

  if (cond.type === 'and') return cond.content.some((entry) => isInactive(entry, settings))
  if (cond.type === 'nor') return cond.content.some((entry) => !isInactive(entry, settings))

  return false
}

function isSettingActive(
  setting: StandaloneSetting,
  settings: readonly StandaloneSetting[],
): boolean {
  return !setting.ifRecorded?.some((cond) => isInactive(cond, settings))
}

function randomizeSetting(setting: StandaloneSetting): void {
  switch (setting.type) {
    case 'Group':
      setting.content.forEach(randomizeSetting)
      return
    case 'ToggleCrossedOut':
    case 'ToggleRecords':
      setting.content.forEach((entry) => {
        entry.content = randomBool()
      })
      return
    case 'ToggleKey':
    case 'ToggleOption':
      setting.content = randomBool()
      return
    case 'PickKey':
      setting.content = randomItem(setting.keys)
      return
    case 'ChooseRecord':
      setting.selected = randomItem(setting.content).key
      return
    case 'ChooseNum':
      setting.content = randomInt(setting.min ?? 0, setting.max)
      return
    case 'SetPartnerKilled':
      setting.content = randomItem(PARTNER_CODES)
      return
    case 'SetPartnerDetails':
      setting.content = {
        damage: randomInt(0, setting.maxDamage),
        horror: randomInt(0, setting.maxHorror),
        status: randomItem(PARTNER_STATUSES),
      }
      return
  }
}

function activeTopLevelSettings(settings: readonly StandaloneSetting[]): StandaloneSetting[] {
  return settings.filter((setting) => isSettingActive(setting, settings))
}

function summarizeSetting(
  setting: StandaloneSetting,
  allSettings: readonly StandaloneSetting[],
): string[] {
  if (!isSettingActive(setting, allSettings)) return []

  switch (setting.type) {
    case 'Group':
      return setting.content.flatMap((entry) => summarizeSetting(entry, allSettings))
    case 'ToggleCrossedOut':
    case 'ToggleRecords': {
      const selected = setting.content
        .filter((entry) => entry.content)
        .map((entry) => entry.label || entry.key)
      return [`${setting.key}: ${selected.length > 0 ? selected.join(', ') : 'none'}`]
    }
    case 'ToggleKey':
    case 'ToggleOption':
      return [`${setting.key}: ${setting.content ? 'yes' : 'no'}`]
    case 'PickKey':
      return [`${setting.key}: ${setting.content}`]
    case 'ChooseRecord':
      return [`${setting.label}: ${setting.selected ?? 'none'}`]
    case 'ChooseNum':
      return [`${setting.key}: ${setting.content}`]
    case 'SetPartnerKilled':
      return [`${setting.key}: ${setting.content ?? 'none'}`]
    case 'SetPartnerDetails':
      return [
        `${setting.key}: ${setting.content.status}, ${setting.content.damage} damage, ${setting.content.horror} horror`,
      ]
  }
}

export function randomizeStandaloneSetup(
  sourceSettings: readonly StandaloneSetting[],
): DraftStandaloneSetupResult {
  const settings = cloneSettings(sourceSettings)
  settings.forEach(randomizeSetting)

  return {
    settings: activeTopLevelSettings(settings),
    summary: settings.flatMap((setting) => summarizeSetting(setting, settings)),
  }
}
