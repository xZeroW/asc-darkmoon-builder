import { useState } from 'react'
import pool from '../data/darkmoon-card-pool.json'

type Category = 'starter_skill' | 'ability' | 'talent'
type Card = (typeof pool.records)[number] & { requiredLevel?: number | null }
type Slot = {
  category: Category
  golden: boolean
  card: Card | null
}

const allCards: Card[] = pool.records

const tabs: { category: Category; label: string; shortLabel: string }[] = [
  { category: 'starter_skill', label: 'Starter Skill Cards', shortLabel: 'Starter Skills' },
  { category: 'ability', label: 'Ability Cards', shortLabel: 'Abilities' },
  { category: 'talent', label: 'Talent Cards', shortLabel: 'Talents' },
]

const qualityClass: Record<string, string> = {
  SKILL_CARD_COMMON: 'common',
  SKILL_CARD_UNCOMMON: 'uncommon',
  SKILL_CARD_RARE: 'rare',
  SKILL_CARD_EPIC: 'epic',
  SKILL_CARD_LEGENDARY: 'legendary',
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

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let output = value
    output = Math.imul(output ^ (output >>> 15), output | 1)
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61)
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296
  }
}

function randomize(slots: Slot[], seed: number) {
  const random = seededRandom(seed)
  const used = new Set<number>()
  return slots.map((slot) => {
    const candidates = allCards.filter(
      (card) => card.category === slot.category && !used.has(card.spellId),
    )
    const card = candidates[Math.floor(random() * candidates.length)] ?? null
    if (card) used.add(card.spellId)
    return { ...slot, card }
  })
}

function CardIcon({ card }: { card: Card }) {
  const initials = card.name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
  const iconUrl = card.iconUrl ? `${import.meta.env.BASE_URL}${card.iconUrl}` : undefined
  return <span className={`card-icon ${qualityClass[card.quality] ?? 'common'}`}>
    {iconUrl && <img src={iconUrl} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />}
    <span>{initials}</span>
  </span>
}

function App() {
  const [activeTab, setActiveTab] = useState<Category>('starter_skill')
  const [slots, setSlots] = useState<Slot[]>(() => randomize(makeSlots(), Date.now()))
  const [search, setSearch] = useState('')

  const visibleSlots = slots.filter((slot) => slot.category === activeTab)
  const filteredCards = allCards.filter(
    (card) => card.category === activeTab && card.name.toLowerCase().includes(search.toLowerCase()),
  )

  function removeCard(slotIndex: number) {
    const indexes = slots.map((slot, index) => ({ slot, index })).filter(({ slot }) => slot.category === activeTab)
    const index = indexes[slotIndex]?.index
    if (index === undefined) return
    setSlots((current) => current.map((slot, itemIndex) => itemIndex === index ? { ...slot, card: null } : slot))
  }

  function selectCard(card: Card, golden: boolean) {
    const existing = slots.some((slot) => slot.golden === golden && slot.card?.spellId === card.spellId)
    if (existing) return
    const targetIndex = slots.findIndex((slot) => slot.category === activeTab && slot.golden === golden && !slot.card)
    const fallbackIndex = slots.findIndex((slot) => slot.category === activeTab && slot.golden === golden)
    const index = targetIndex === -1 ? fallbackIndex : targetIndex
    if (index === -1) return
    setSlots((current) => current.map((slot, itemIndex) => itemIndex === index ? { ...slot, card } : slot))
  }

  function reset() {
    setSlots(randomize(makeSlots(), Date.now()))
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
            <button key={tab.category} className={activeTab === tab.category ? 'tab active' : 'tab'} onClick={() => setActiveTab(tab.category)}>
              {tab.label}
            </button>
          ))}
          <span className="tabs-spacer" />
          <button className="reset-button" onClick={reset}>Reset build</button>
          <div className="top-search">
            <span aria-hidden="true">⌕</span>
            <input placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
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
                <article key={`${slot.category}-${index}`} className={`slot ${slot.golden ? 'golden-slot' : ''} ${slot.card ? 'filled' : 'empty'}`}>
                  {slot.card ? <>
                    <div className="slot-corners" />
                    <div className="slot-topline">
                      <span className={qualityClass[slot.card.quality] ?? 'common'}>{slot.card.quality.replace('SKILL_CARD_', '')}</span>
                      <button className="remove" aria-label={`Remove ${slot.card.name}`} onClick={() => removeCard(index)}>×</button>
                    </div>
                    <CardIcon card={slot.card} />
                    <h3>{slot.card.name}</h3>
                  </> : <>
                    <span className="empty-mark">✧</span>
                    <p>{slot.golden ? 'Golden Card slot' : 'Card slot'}</p>
                  </>}
                </article>
              ))}
            </div>
          </section>

          <aside className="collection">
            <div className="collection-title">{tabs.find((tab) => tab.category === activeTab)?.label} Collection</div>
            <p className="collection-count">{filteredCards.length.toLocaleString()} cards available</p>
            {([false, true] as const).map((golden) => (
              <section key={String(golden)} className={golden ? 'collection-pane golden-pane' : 'collection-pane'}>
                <h3>{golden ? 'Golden Cards' : 'Normal Cards'}</h3>
                <div className="card-list">
                  {filteredCards.map((card) => {
                    const selected = slots.some((slot) => slot.golden === golden && slot.card?.spellId === card.spellId)
                    return <button key={card.cardId} className={selected ? 'collection-card selected' : 'collection-card'} onClick={() => selectCard(card, golden)} disabled={selected}>
                      <CardIcon card={card} />
                      <span className="list-name">{card.name}</span>
                      <span className={`quality-dot ${qualityClass[card.quality] ?? 'common'}`} />
                      <span className="rank">{card.requiredLevel ?? '?'}</span>
                    </button>
                  })}
                </div>
              </section>
            ))}
          </aside>
        </div>

      </section>
    </main>
  )
}

export default App
