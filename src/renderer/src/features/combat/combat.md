# Combat Phase - Technical Documentation

This module defines the client-side visualization of the host-authoritative combat logs. The combat simulation runs instantly on the host's system and produces a deterministic list of chronological events. The client's job is to play these events back with a slight delay, simulating a real-time battle.

## Combat Event Types & Schema

Each combat log event has a specific structure depending on the action type.

### 1. Attack / Spell / Critical Hits
Occurs when a player hero strikes the boss monster.
```json
{
  "type": "attack" | "spell" | "crit",
  "actor": "Kaelen",
  "actorClass": "Mage",
  "target": "Cinder Claw the Red Drake",
  "value": 32,
  "bossHp": 268,
  "text": "Kaelen (Mage) casts Fireball on Cinder Claw the Red Drake dealing 32 magic damage!"
}
```

### 2. Healing
Occurs when a Cleric heals a damaged hero.
```json
{
  "type": "heal",
  "actor": "Sylvia",
  "actorClass": "Cleric",
  "target": "Soren",
  "value": 18,
  "targetHp": 128,
  "text": "Sylvia (Cleric) casts Holy Light on Soren, restoring 18 HP!"
}
```

### 3. Boss Attack
Occurs when the boss strikes a random hero.
```json
{
  "type": "boss_attack",
  "actor": "Cinder Claw the Red Drake",
  "target": "Soren",
  "targetClass": "Warrior",
  "value": 15,
  "targetHp": 85,
  "text": "👹 Cinder Claw strikes Soren for 15 damage!"
}
```

### 4. Player Death
Occurs immediately when a hero's HP falls to 0.
```json
{
  "type": "death",
  "target": "Lira",
  "targetClass": "Rogue",
  "text": "💀 Lira has fallen in battle!"
}
```

### 5. Resolution (Victory / Defeat)
Triggers the conclusion screen and displays final overlays.
```json
{
  "type": "victory" | "defeat",
  "text": "🏆 Cinder Claw has been vanquished! Victory is ours!"
}
```

## Animation Loop & Visual Effects

To create a premium feel, the client iterates over the events queue:
- **Ticker Interval**: Moves forward in the event queue every `1200ms` - `1500ms`.
- **Floating Damage/Healing Texts**: When a player receives damage or healing, a temporary animating span is created overlaying their profile card (e.g. red `-18` or green `+15`) that floats upwards and fades out.
- **Card Impact Flash**: When a participant takes damage, their card borders flash red briefly.
- **Scroll Control**: The scrolling console log automatically keeps scrolled to the bottom as new lines print.
