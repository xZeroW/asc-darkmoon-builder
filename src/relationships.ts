export type Relationship = {
  title: string
  cards: string[]
  steps: string[]
}

// Explicit, reviewable card interactions. Add rules here as game mechanics are verified.
export const relationships: Relationship[] = [
  {
    title: 'Arcane Gunslinger Barrage',
    cards: ['Arcane Shot', 'Arcane Gunslinger', 'Arcane Barrage'],
    steps: [
      'Arcane Shot grants Arcane Gunslinger.',
      'Arcane Gunslinger increases Arcane Barrage damage and can grant Missile Barrage.',
    ],
  },
  {
    title: 'Arcane Shelling Barrage',
    cards: ['Arcane Shot', 'Arcane Shelling', 'Arcane Barrage'],
    steps: [
      'Arcane Shot damage grants Arcane Shelling.',
      'Arcane Shelling stacks to increase Arcane Barrage damage.',
    ],
  },
  {
    title: 'Missile Barrage Channel',
    cards: ['Arcane Shot', 'Arcane Gunslinger', 'Arcane Missiles'],
    steps: [
      'Arcane Shot grants Arcane Gunslinger.',
      'Arcane Gunslinger can grant Missile Barrage.',
      'Missile Barrage shortens and removes the mana cost of Arcane Missiles.',
    ],
  },
  {
    title: 'Barrage Overload Payoff',
    cards: ['Arcane Gunslinger', 'Arcane Missiles', 'Barrage Overload', 'Arcane Barrage'],
    steps: [
      'Arcane Gunslinger can grant Missile Barrage for Arcane Missiles.',
      'Consuming Missile Barrage with Arcane Missiles grants Barrage Overload.',
      'Arcane Barrage consumes Barrage Overload for additional arcane bolts.',
    ],
  },
  {
    title: 'Shot Weaving Barrage',
    cards: ['Arcane Gunslinger', 'Arcane Missiles', 'Shot Weaving'],
    steps: [
      'Arcane Gunslinger can grant Missile Barrage.',
      'Shot Weaving adds a ranged shot to each Arcane Missile while Missile Barrage is active.',
    ],
  },
]
