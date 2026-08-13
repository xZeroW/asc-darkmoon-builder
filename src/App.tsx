import { useEffect, useState } from 'react'
import type { PointerEvent, UIEvent } from 'react'

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
    const alternatives = requirement.split(/,|\s+or\s+/i)
      .map((value) => value.trim().replace(/[.]$/, ''))
      .filter((value) => value && !gearRequirements.has(value.toLowerCase()))
    if (alternatives.length) requirements.push(alternatives)
  }
  return requirements
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

function CardIcon({ card }: { card: Card }) {
  const initials = card.name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
  const iconUrl = card.iconUrl ? `${import.meta.env.BASE_URL}${card.iconUrl}` : undefined
  return <span className={`card-icon ${qualityClass[card.quality] ?? 'common'}`}>
    {iconUrl && <img src={iconUrl} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = 'none' }} />}
    <span>{initials}</span>
  </span>
}

function SpellTooltip({ tooltip }: { tooltip: Tooltip }) {
  const { card, x, y } = tooltip
  return <aside className="spell-tooltip" style={{ left: x + 16, top: y + 16 }} role="tooltip">
    <h3>{card.name}</h3>
    {card.tooltipLines ? <div className="tooltip-lines">
      {card.tooltipLines.slice(1).map((line, index) => <p key={index} className={line.left?.startsWith('Requires') ? 'tooltip-requirement' : 'tooltip-line'}>
        <span>{line.left}</span><span>{line.right}</span>
      </p>)}
    </div> : <>
      <div className="tooltip-details"><span>{card.qualityCost ?? '?'} Essence</span><span>{card.requiredLevel ?? '?'} level</span></div>
      <p className="tooltip-rank">{card.rank === card.maxRank ? 'Rank ' + card.rank : `Rank ${card.rank}/${card.maxRank}`}</p>
      {card.description && <p className="tooltip-description">{card.description}</p>}
    </>}
    <div className="tooltip-footer">
      <span>Skill Card</span>
      <span>Spell ID {card.spellId}</span>
    </div>
  </aside>
}

function CardList({ cards, golden, slots, onSelect, onShowTooltip, onMoveTooltip, onHideTooltip }: {
  cards: Card[]
  golden: boolean
  slots: Slot[]
  onSelect: (card: Card, golden: boolean) => void
  onShowTooltip: (card: Card, event: PointerEvent) => void
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
          return <button key={card.cardId} className={selected ? 'collection-card selected' : 'collection-card'} onClick={() => onSelect(card, golden)} disabled={selected} onPointerEnter={(event) => onShowTooltip(card, event)} onPointerMove={onMoveTooltip} onPointerLeave={onHideTooltip}>
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

  const visibleSlots = slots.filter((slot) => slot.category === activeTab)
  const selectedNames = new Set(slots.flatMap((slot) => slot.card ? [normalizeName(slot.card.name)] : []))
  const missingRequirements = new Map<number, string[]>()
  for (const slot of slots) {
    if (!slot.card) continue
    const missing = getCardRequirements(slot.card)
      .filter((alternatives) => !alternatives.some((requirement) => selectedNames.has(normalizeName(requirement))))
      .map((alternatives) => alternatives.join(' or '))
    if (missing.length) missingRequirements.set(slot.card.cardId, missing)
  }
  const activeWarnings = visibleSlots.flatMap((slot) => slot.card ? (missingRequirements.get(slot.card.cardId) ?? []).map((requirement) => `${slot.card!.name}: requires ${requirement}`) : [])
  const selectedPaths = [...new Set(slots.flatMap((slot) => slot.card?.name.startsWith('Path of ') ? [slot.card.name] : []))]
  if (selectedPaths.length > 1) {
    activeWarnings.push(`Only one path can be selected: ${selectedPaths.join(', ')}`)
  }
  const normalizedSearch = search.toLowerCase()
  const filteredCards = (cardsByCategory[activeTab] ?? []).filter((card) =>
    card.name.toLowerCase().includes(normalizedSearch)
    || card.description?.toLowerCase().includes(normalizedSearch),
  )

  function removeCard(slotIndex: number) {
    const indexes = slots.map((slot, index) => ({ slot, index })).filter(({ slot }) => slot.category === activeTab)
    const index = indexes[slotIndex]?.index
    if (index === undefined) return
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

  function showTooltip(card: Card, event: PointerEvent) {
    setTooltip({ card, x: event.clientX, y: event.clientY })
  }

  function moveTooltip(event: PointerEvent) {
    setTooltip((current) => current && { ...current, x: event.clientX, y: event.clientY })
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
                  className={`slot ${slot.golden ? 'golden-slot' : ''} ${slot.card ? 'filled' : 'empty'} ${slot.card && missingRequirements.has(slot.card.cardId) ? 'invalid-slot' : ''}`}
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
          </section>

          <aside className="collection">
            <div className="collection-title">{tabs.find((tab) => tab.category === activeTab)?.label} Collection</div>
            <p className="collection-count">{filteredCards.length.toLocaleString()} cards available</p>
            {([false, true] as const).map((golden) => (
              <section key={String(golden)} className={golden ? 'collection-pane golden-pane' : 'collection-pane'}>
                <h3>{golden ? 'Golden Cards' : 'Normal Cards'}</h3>
                <CardList key={`${activeTab}-${golden}-${search}`} cards={filteredCards} golden={golden} slots={slots} onSelect={selectCard} onShowTooltip={showTooltip} onMoveTooltip={moveTooltip} onHideTooltip={() => setTooltip(null)} />
              </section>
            ))}
          </aside>
        </div>

      </section>
      {tooltip && <SpellTooltip tooltip={tooltip} />}
    </main>
  )
}

export default App
