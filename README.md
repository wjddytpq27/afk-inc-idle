# AFK 주식회사 — 방치형 AI 제국 (Idle Money Game)

A dependency-free, vanilla-JS idle/clicker game. Hire your first bot and let AI
earn money while you're away. Buy generators, hit milestone multipliers, unlock
auto-buy, and prestige into the singularity.

- **No build step.** Pure `index.html` + `style.css` + `game.js`.
- **Mobile-first**, offline-earning, localStorage save.
- **Evolving diorama** that grows from a street stall to a spacefaring empire.

## Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy

Static site — deploys to any static host (Vercel, Netlify, GitHub Pages) with
no configuration.

## Structure

| File | Purpose |
|------|---------|
| `index.html` | DOM shell + title/offline modals |
| `style.css`  | Dark neon-gold theme, all UI + scene styling |
| `game.js`    | Full game loop, economy, save/load, prestige, scene |

## Monetization

Rewarded-video ad hooks (2× boost, double offline earnings) are wired through a
thin `Ads` abstraction so a real HTML5 portal SDK (GameMonetize / GameDistribution)
can be dropped in without touching game logic.
