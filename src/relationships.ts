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
