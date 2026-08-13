import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, RefObject, UIEvent } from 'react'
import { discoverRelationships, discoverSuggestions } from './relationships'

type Category = 'starter_skill' | 'ability' | 'talent'
type Card = {
  cardId: number
  name: string
  quality: string
  spellId: number
  iconUrl?: string | null
  description?: string | null
  tooltipLines?: { left?: string | null; right?: string | null }[] | null
  requiredLevel?: number | null
  qualityCost?: number | null
  rank?: number | null
  maxRank?: number | null
}
type Slot = {
  category: Category
  golden: boolean
  card: Card | null
}
type Tooltip = {
  card: Card
  x: number
  y: number
  suggestedBy?: string[]
}

const tabs: { category: Category; label: string; shortLabel: string }[] = [
  { category: 'starter_skill', label: 'Starter Skill Cards', shortLabel: 'Starter Skills' },
  { category: 'ability', label: 'Ability Cards', shortLabel: 'Abilities' },
  { category: 'talent', label: 'Talent Cards', shortLabel: 'Talents' },
]

const cardLoaders: Record<Category, () => Promise<{ default: { records: Card[] } }>> = {
  starter_skill: () => import('../data/cards/starter_skill.json'),
  ability: () => import('../data/cards/ability.json'),
  talent: () => import('../data/cards/talent.json'),
}

const qualityClass: Record<string, string> = {
  SKILL_CARD_COMMON: 'common',
  SKILL_CARD_UNCOMMON: 'uncommon',
  SKILL_CARD_RARE: 'rare',
  SKILL_CARD_EPIC: 'epic',
  SKILL_CARD_LEGENDARY: 'legendary',
}
const cardRowHeight = 54
const overscanRows = 8
const gearRequirements = new Set([
  'daggers', 'fist weapons', 'melee weapon', 'one-handed melee weapon', 'ranged weapon', 'shields',
])

function normalizeName(value: string) {
  return value.replace(/[".]/g, '').trim().toLowerCase()
}

function getCardRequirements(card: Card) {
  const requirements: string[][] = []
  for (const line of card.tooltipLines ?? []) {
    const text = line.left?.split('\n', 1)[0]?.trim()
    if (!text?.startsWith('Requires ')) continue
    const requirement = text.slice('Requires '.length).trim()
    if (/^level\s+\d+$/i.test(requirement) || /^primary stat:/i.test(requirement)) continue
    if (/^path of /i.test(requirement)) continue
    const alternatives = requirement.split(/,|\s+or\s+/i)
      .map((value) => value.trim().replace(/[.]$/, ''))
      .filter((value) => value && !gearRequirements.has(value.toLowerCase()))
    if (alternatives.length) requirements.push(alternatives)
  }
  return requirements
}

function getRequiredPaths(card: Card) {
  const paths = new Set<string>()
  for (const line of card.tooltipLines ?? []) {
    for (const match of line.left?.matchAll(/Requires\s+Path of ([^\n.]+)/gi) ?? []) {
      paths.add(`Path of ${match[1].trim()}`)
    }
  }
  return [...paths]
}

function makeSlots(): Slot[] {
  return tabs.flatMap(({ category }) => {
    const total = category === 'starter_skill' ? 4 : 6
    return Array.from({ length: total }, (_, index) => ({
      category,
      golden: index >= total / 2,
      card: null,
    }))
  })
}

function encodeBuild(slots: Slot[]) {
  return slots.map((slot) => slot.card?.cardId.toString(36) ?? '').join('.')
}

function decodeBuild(value: string | null) {
  if (!value) return []
  return value.split('.').map((id) => id ? Number.parseInt(id, 36) : null)
}

function CardIcon({ card }: { card: Card }) {
  const initials = card.name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
  const iconUrl = card.iconUrl ? `${import.meta.env.BASE_URL}${card.iconUrl}` : undefined
  return <span className={`card-icon ${qualityClass[card.quality] ?? 'common'}`}>
    {iconUrl && <img src={iconUrl} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = 'none' }} />}
    <span>{initials}</span>
  </span>
}

function SpellTooltip({ tooltip, tooltipRef }: { tooltip: Tooltip; tooltipRef: RefObject<HTMLElement | null> }) {
  const { card, x, y, suggestedBy } = tooltip
  return <aside ref={tooltipRef} className="spell-tooltip" style={{ left: x + 16, top: y + 16 }} role="tooltip">
    <h3>{card.name}</h3>
    {card.tooltipLines ? <div className="tooltip-lines">
      {card.tooltipLines.slice(1).map((line, index) => {
        const [requirement, ...descriptionLines] = line.left?.split('\n') ?? []
        const hasRequirement = requirement?.startsWith('Requires ')
        return <div key={index}>
          {hasRequirement && <p className="tooltip-requirement"><span>{requirement}</span></p>}
          {(descriptionLines.length > 0 || !hasRequirement) && <p className="tooltip-line">
            <span>{hasRequirement ? descriptionLines.join('\n').trim() : line.left}</span><span>{line.right}</span>
          </p>}
        </div>
      })}
    </div> : <>
      <div className="tooltip-details"><span>{card.qualityCost ?? '?'} Essence</span><span>{card.requiredLevel ?? '?'} level</span></div>
      <p className="tooltip-rank">{card.rank === card.maxRank ? 'Rank ' + card.rank : `Rank ${card.rank}/${card.maxRank}`}</p>
      {card.description && <p className="tooltip-description">{card.description}</p>}
    </>}
    {suggestedBy && <p className="tooltip-suggestion">Suggested by: {suggestedBy.join(', ')}</p>}
    <div className="tooltip-footer">
      <span>Skill Card</span>
      <span>Spell ID {card.spellId}</span>
    </div>
  </aside>
}

function CardList({ cards, golden, slots, suggestedBy, onSelect, onShowTooltip, onMoveTooltip, onHideTooltip }: {
  cards: Card[]
  golden: boolean
  slots: Slot[]
  suggestedBy: Map<number, string[]>
  onSelect: (card: Card, golden: boolean) => void
  onShowTooltip: (card: Card, event: PointerEvent, suggestedBy?: string[]) => void
  onMoveTooltip: (event: PointerEvent) => void
  onHideTooltip: () => void
}) {
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(0)
  const firstRow = Math.max(0, Math.floor(scrollTop / cardRowHeight) - overscanRows)
  const visibleRows = Math.ceil(height / cardRowHeight) + overscanRows * 2
  const cardsToRender = cards.slice(firstRow, firstRow + visibleRows)

  function updateViewport(event: UIEvent<HTMLDivElement>) {
    setScrollTop(event.currentTarget.scrollTop)
    setHeight(event.currentTarget.clientHeight)
  }

  return <div className="card-list" onScroll={updateViewport} onPointerEnter={updateViewport}>
    <div className="card-list-spacer" style={{ height: cards.length * cardRowHeight }}>
      <div className="card-list-window" style={{ transform: `translateY(${firstRow * cardRowHeight}px)` }}>
        {cardsToRender.map((card) => {
          const selected = slots.some((slot) => slot.card?.spellId === card.spellId)
          return <button key={card.cardId} className={selected ? 'collection-card selected' : 'collection-card'} onClick={() => onSelect(card, golden)} disabled={selected} onPointerEnter={(event) => onShowTooltip(card, event, suggestedBy.get(card.cardId))} onPointerMove={onMoveTooltip} onPointerLeave={onHideTooltip}>
            <CardIcon card={card} />
            <span className="list-name">{card.name}</span>
            <span className={`quality-dot ${qualityClass[card.quality] ?? 'common'}`} />
            <span className="rank">{card.requiredLevel ?? '?'}</span>
          </button>
        })}
      </div>
    </div>
  </div>
}

function App() {
  const [activeTab, setActiveTab] = useState<Category>('starter_skill')
  const [slots, setSlots] = useState<Slot[]>(makeSlots)
  const [search, setSearch] = useState('')
  const [cardsByCategory, setCardsByCategory] = useState<Partial<Record<Category, Card[]>>>({})
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [shareStatus, setShareStatus] = useState('Share build')
  const [buildRestored, setBuildRestored] = useState(() => !new URLSearchParams(window.location.search).has('build'))
  const tooltipElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (cardsByCategory[activeTab]) return
    let cancelled = false
    void cardLoaders[activeTab]().then(({ default: pool }) => {
      if (!cancelled) {
        setCardsByCategory((current) => ({ ...current, [activeTab]: pool.records }))
      }
    })
    return () => { cancelled = true }
  }, [activeTab, cardsByCategory])

  useEffect(() => {
    const cardIds = decodeBuild(new URLSearchParams(window.location.search).get('build'))
    if (!cardIds.length) {
      setBuildRestored(true)
      return
    }
    let cancelled = false
    void Promise.all(tabs.map(({ category }) => cardLoaders[category]())).then((pools) => {
      if (cancelled) return
      const cardsById = new Map(pools.flatMap(({ default: pool }) => pool.records).map((card) => [card.cardId, card]))
      setCardsByCategory((current) => ({
        ...current,
        ...Object.fromEntries(tabs.map((tab, index) => [tab.category, pools[index].default.records])),
      }))
      setSlots((current) => current.map((slot, index) => ({ ...slot, card: cardIds[index] ? cardsById.get(cardIds[index]!) ?? null : null })))
      setBuildRestored(true)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!buildRestored) return
    const url = new URL(window.location.href)
    const build = encodeBuild(slots)
    if (build.replace(/\./g, '')) url.searchParams.set('build', build)
    else url.searchParams.delete('build')
    window.history.replaceState(null, '', url)
  }, [buildRestored, slots])

  useEffect(() => {
    if (!showSuggestions) return
    for (const category of tabs.map((tab) => tab.category)) {
      if (cardsByCategory[category]) continue
      void cardLoaders[category]().then(({ default: pool }) => {
        setCardsByCategory((current) => current[category] ? current : { ...current, [category]: pool.records })
      })
    }
  }, [showSuggestions, cardsByCategory])

  const visibleSlots = slots.filter((slot) => slot.category === activeTab)
  const selectedNames = new Set(slots.flatMap((slot) => slot.card ? [normalizeName(slot.card.name)] : []))
  const selectedCards = slots.flatMap((slot) => slot.card ? [slot.card] : [])
  const activeRelationships = discoverRelationships(slots.flatMap((slot) => slot.card ? [slot.card] : []))
  const suggestedByCardId = showSuggestions
    ? discoverSuggestions(selectedCards, Object.values(cardsByCategory).flat())
    : new Map<number, string[]>()
  const missingRequirements = new Map<number, string[]>()
  for (const slot of slots) {
    if (!slot.card) continue
    const missing = getCardRequirements(slot.card)
      .filter((alternatives) => !alternatives.some((requirement) => selectedNames.has(normalizeName(requirement))))
      .map((alternatives) => alternatives.join(' or '))
    if (missing.length) missingRequirements.set(slot.card.cardId, missing)
  }
  const activeWarnings = visibleSlots.flatMap((slot) => slot.card ? (missingRequirements.get(slot.card.cardId) ?? []).map((requirement) => `${slot.card!.name}: requires ${requirement}`) : [])
  const selectedPaths = [...new Set(slots.flatMap((slot) => slot.card ? [
    ...(slot.card.name.startsWith('Path of ') ? [slot.card.name] : []),
    ...getRequiredPaths(slot.card),
  ] : []))]
  const hasPathConflict = selectedPaths.length > 1
  if (hasPathConflict) {
    activeWarnings.push(`Incompatible path requirements: ${selectedPaths.join(', ')}`)
  }
  const normalizedSearch = search.toLowerCase()
  const filteredCards = (cardsByCategory[activeTab] ?? []).filter((card) =>
    (card.name.toLowerCase().includes(normalizedSearch)
      || card.description?.toLowerCase().includes(normalizedSearch))
    && (!showSuggestions || suggestedByCardId.has(card.cardId)),
  )

  function removeCard(slotIndex: number) {
    const indexes = slots.map((slot, index) => ({ slot, index })).filter(({ slot }) => slot.category === activeTab)
    const index = indexes[slotIndex]?.index
    if (index === undefined) return
    setTooltip(null)
    setSlots((current) => current.map((slot, itemIndex) => itemIndex === index ? { ...slot, card: null } : slot))
  }

  function selectCard(card: Card, golden: boolean) {
    const existing = slots.some((slot) => slot.card?.spellId === card.spellId)
    if (existing) return
    const targetIndex = slots.findIndex((slot) => slot.category === activeTab && slot.golden === golden && !slot.card)
    if (targetIndex === -1) return
    setSlots((current) => current.map((slot, itemIndex) => itemIndex === targetIndex ? { ...slot, card } : slot))
  }

  function reset() {
    setSlots(makeSlots())
  }

  async function shareBuild() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareStatus('Link copied')
    } catch {
      setShareStatus('Copy the URL')
    }
  }

  function showTooltip(card: Card, event: PointerEvent, suggestedBy?: string[]) {
    setTooltip({ card, x: event.clientX, y: event.clientY, suggestedBy })
  }

  function moveTooltip(event: PointerEvent) {
    if (!tooltipElement.current) return
    tooltipElement.current.style.left = `${event.clientX + 16}px`
    tooltipElement.current.style.top = `${event.clientY + 16}px`
  }

  return (
    <main className="world">
      <section className="game-frame">
        <header className="title-bar">
          <span className="sigil">✦</span>
          <h1>Skill Cards</h1>
          <span className="close">×</span>
        </header>

        <div className="tabs" role="tablist" aria-label="Skill card categories">
          {tabs.map((tab) => (
            <button key={tab.category} className={activeTab === tab.category ? 'tab active' : 'tab'} onClick={() => { setTooltip(null); setActiveTab(tab.category) }}>
              {tab.label}
            </button>
          ))}
          <span className="tabs-spacer" />
            <button className="reset-button" onClick={reset}>Reset build</button>
            <button className="share-button" onClick={() => void shareBuild()}>{shareStatus}</button>
            <button className={showSuggestions ? 'suggestions-toggle active' : 'suggestions-toggle'} onClick={() => setShowSuggestions((show) => !show)}>
              {showSuggestions ? 'Suggested cards' : 'Show suggestions'}
            </button>
          <div className="top-search">
            <span aria-hidden="true">⌕</span>
            <input placeholder="Search" value={search} onFocus={() => setTooltip(null)} onChange={(event) => { setTooltip(null); setSearch(event.target.value) }} />
            <button onClick={() => setSearch('')} aria-label="Clear search">×</button>
          </div>
        </div>

        <div className="content">
          <section className="build-area">
            <div className="build-heading">
              <div>
                <span className="eyebrow">Darkmoon Wildcard</span>
                <h2>Selected {tabs.find((tab) => tab.category === activeTab)?.shortLabel}</h2>
              </div>
            </div>
            <p className="instruction">Select from the collection to add a card. Gold frames indicate Golden Card slots.</p>
            <div className={activeTab === 'starter_skill' ? 'slot-grid starter-slot-grid' : 'slot-grid'}>
              {visibleSlots.map((slot, index) => (
                <article
                  key={`${slot.category}-${index}`}
                  className={`slot ${slot.golden ? 'golden-slot' : ''} ${slot.card ? 'filled' : 'empty'} ${slot.card && (missingRequirements.has(slot.card.cardId) || (hasPathConflict && getRequiredPaths(slot.card).length > 0)) ? 'invalid-slot' : ''}`}
                  onPointerEnter={slot.card ? (event) => showTooltip(slot.card!, event) : undefined}
                  onPointerMove={slot.card ? moveTooltip : undefined}
                  onPointerLeave={slot.card ? () => setTooltip(null) : undefined}
                  onContextMenu={(event) => {
                    if (!slot.card) return
                    event.preventDefault()
                    removeCard(index)
                  }}
                >
                  {slot.card ? <>
                    <div className="slot-corners" />
                    <div className="slot-topline">
                      <span className={qualityClass[slot.card.quality] ?? 'common'}>{slot.card.quality.replace('SKILL_CARD_', '')}</span>
                      <button className="remove" aria-label={`Remove ${slot.card.name}`} onClick={() => removeCard(index)}>×</button>
                    </div>
                    <CardIcon card={slot.card} />
                    <h3>{slot.card.name}</h3>
                    {missingRequirements.has(slot.card.cardId) && <span className="requirement-marker">Missing requirement</span>}
                    {hasPathConflict && getRequiredPaths(slot.card).length > 0 && <span className="requirement-marker">Incompatible path</span>}
                  </> : <>
                    <span className="empty-mark">✧</span>
                    <p>{slot.golden ? 'Golden Card slot' : 'Card slot'}</p>
                  </>}
                </article>
              ))}
            </div>
            {activeWarnings.length > 0 && <div className="requirement-warnings" role="alert">
              {activeWarnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>}
            {activeRelationships.length > 0 && <section className="relationships" aria-label="Active card synergies">
              <h3>Detected Synergies</h3>
              {activeRelationships.map((relationship) => <article key={`${relationship.source}-${relationship.target}`}>
                <h4>{relationship.source} <span>→</span> {relationship.target}</h4>
                <p>{relationship.evidence}</p>
              </article>)}
            </section>}
          </section>

          <aside className="collection">
            <div className="collection-title">{tabs.find((tab) => tab.category === activeTab)?.label} Collection</div>
            <p className="collection-count">{filteredCards.length.toLocaleString()} {showSuggestions ? 'suggested' : 'cards available'}</p>
            {([false, true] as const).map((golden) => (
              <section key={String(golden)} className={golden ? 'collection-pane golden-pane' : 'collection-pane'}>
                <h3>{golden ? 'Golden Cards' : 'Normal Cards'}</h3>
                <CardList key={`${activeTab}-${golden}-${search}`} cards={filteredCards} golden={golden} slots={slots} suggestedBy={suggestedByCardId} onSelect={selectCard} onShowTooltip={showTooltip} onMoveTooltip={moveTooltip} onHideTooltip={() => setTooltip(null)} />
              </section>
            ))}
          </aside>
        </div>

      </section>
      {tooltip && <SpellTooltip tooltip={tooltip} tooltipRef={tooltipElement} />}
    </main>
  )
}

export default App
