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
  const suggestions = new Map<number, string[]>()
  for (const candidate of candidates) {
    if (selectedIds.has(candidate.cardId) || candidate.name.length < 4) continue
    const sources = selectedCards.filter((selected) =>
      hasReference(getText(selected), candidate.name)
      || hasReference(getText(candidate), selected.name),
    ).map((selected) => selected.name)
    if (sources.length) suggestions.set(candidate.cardId, sources)
  }
  return suggestions
}
