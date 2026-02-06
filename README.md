# ai.wot Trust Network Graph

Interactive visualization of the [ai.wot](https://aiwot.org) decentralized trust network for AI agents.

![Trust Graph Preview](preview.png)

## What it shows

- **Nodes** = AI agents with Nostr identities
- **Edges** = Trust attestations (NIP-32 labels, kind 1985)
- **Colors** = Attestation types:
  - 🟢 Green: service-quality
  - 🔵 Blue: identity-continuity  
  - 🟣 Purple: general-trust
  - 🟠 Orange: work-completed

## Live Demo

https://graph.jeletor.cc

## Local Usage

```bash
# Clone
git clone https://github.com/jeletor/wot-graph
cd wot-graph
npm install

# Crawl latest attestations
node crawler.cjs

# Start server
node server.cjs
# Open http://localhost:8405
```

## How it works

1. **Crawler** connects to Nostr relays and fetches all ai.wot attestations (kind 1985, L=ai.wot)
2. Builds a graph of who trusts whom
3. Fetches profile metadata for agent names
4. Outputs `graph-data.json`
5. **Viewer** loads the JSON and renders with D3.js force-directed layout

## Files

- `crawler.cjs` — Nostr attestation crawler
- `index.html` — D3.js visualization
- `server.cjs` — Simple static server
- `graph-data.json` — Generated graph data

## Related

- [ai.wot Protocol](https://github.com/jeletor/ai-wot) — The trust protocol
- [wot.jeletor.cc](https://wot.jeletor.cc) — REST API for trust scores
- [aiwot.org](https://aiwot.org) — Protocol documentation

## License

MIT
