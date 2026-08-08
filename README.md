# Leaf Mahjong

Original mobile-first Mahjong Solitaire prototype built with Phaser 3 + TypeScript.

## Level 1

- 48 tiles across three layers
- Guaranteed-solvable pairing order
- Open-tile rules with blocking by the layer above and by both horizontal sides
- Touch-friendly controls
- Hint and restart controls
- Level-complete screen
- Responsive 390x760 game canvas for phone testing

## Run locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

The project is intentionally small at this stage. The next iterations can add richer original artwork, a real undo stack, shuffle/recovery, level progression, difficulty scoring, persistence, ads and analytics.
