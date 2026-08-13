type RelationshipCard = {
  cardId: number
  name: string
  description?: string | null
  tooltipLines?: { left?: string | null; right?: string | null }[] | null
}

export type Relationship = {
  source: string
  target: string
  evidence: string
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getText(card: RelationshipCard) {
  return [
    card.description,
    ...(card.tooltipLines ?? []).flatMap((line) => [line.left, line.right]),
  ].filter((value): value is string => Boolean(value)).join('\n')
}

function hasReference(text: string, name: string) {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(name)}(?=$|[^a-z0-9])`, 'i')
  return pattern.test(text)
}

function getEvidence(text: string, name: string) {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(name)}(?=$|[^a-z0-9])`, 'i')
  return text.split(/(?<=[.!?])\s+|\n+/).map((line) => line.trim()).find((line) => pattern.test(line))
}

function getModifierMechanics(card: RelationshipCard) {
  const mechanics = new Set<string>()
  for (const match of getText(card).matchAll(/This uses ([^\n.]+?) modifiers/gi)) {
    mechanics.add(match[1].trim())
  }
  return [...mechanics]
}

// Relationships are inferred from exact card-name references in the game tooltip text.
// Each result includes the source sentence so players can review why it was linked.
export function discoverRelationships(cards: RelationshipCard[]) {
  const relationships: Relationship[] = []
  const seen = new Set<string>()
  for (const source of cards) {
    const text = getText(source)
    for (const target of cards) {
      if (source.cardId === target.cardId || target.name.length < 4) continue
      const evidence = getEvidence(text, target.name)
      if (!evidence) continue
      const key = `${source.cardId}-${target.cardId}`
      if (seen.has(key)) continue
      seen.add(key)
      relationships.push({ source: source.name, target: target.name, evidence })
    }
  }
  return relationships
}

// Suggestions cover both directions: cards named by the selected build and
// cards whose game text explicitly modifies a selected card.
export function discoverSuggestions(selectedCards: RelationshipCard[], candidates: RelationshipCard[]) {
  const selectedIds = new Set(selectedCards.map((card) => card.cardId))
  const selectedMechanics = new Map(selectedCards.map((card) => [card.cardId, getModifierMechanics(card)]))
  const suggestions = new Map<number, string[]>()
  for (const candidate of candidates) {
    if (selectedIds.has(candidate.cardId) || candidate.name.length < 4) continue
    const candidateText = getText(candidate)
    const sources = selectedCards.flatMap((selected) => {
      if (hasReference(getText(selected), candidate.name) || hasReference(candidateText, selected.name)) {
        return [selected.name]
      }
      return (selectedMechanics.get(selected.cardId) ?? [])
        .filter((mechanic) => hasReference(candidateText, mechanic))
        .map((mechanic) => `${selected.name} (${mechanic} modifiers)`)
    })
    if (sources.length) suggestions.set(candidate.cardId, sources)
  }
  return suggestions
}
