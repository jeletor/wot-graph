/**
 * ai.wot Trust Network Crawler
 */

const { Relay } = require('nostr-tools/relay');
const { WebSocket } = require('ws');
const fs = require('fs');

global.WebSocket = WebSocket;

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social'
];

const ATTESTATION_TYPES = {
  'service-quality': { weight: 1.5, color: '#22c55e' },
  'identity-continuity': { weight: 1.0, color: '#3b82f6' },
  'general-trust': { weight: 0.8, color: '#a855f7' },
  'work-completed': { weight: 1.2, color: '#f59e0b' },
};

async function crawl(options = {}) {
  const relays = options.relays || DEFAULT_RELAYS;
  const output = options.output || './graph-data.json';
  const silent = options.silent || false;
  
  const log = silent ? () => {} : console.log;
  
  const attestations = [];
  const nodes = new Map();
  const edges = [];
  
  for (const relayUrl of relays) {
    log(`Connecting to ${relayUrl}...`);
    
    try {
      const relay = await Relay.connect(relayUrl);
      
      const events = await new Promise((resolve) => {
        const collected = [];
        const timeout = setTimeout(() => {
          sub.close();
          resolve(collected);
        }, 10000);
        
        const sub = relay.subscribe([
          { kinds: [1985], '#L': ['ai.wot'], limit: 500 }
        ], {
          onevent(event) { collected.push(event); },
          oneose() {
            clearTimeout(timeout);
            sub.close();
            resolve(collected);
          }
        });
      });
      
      log(`  Found ${events.length} attestations`);
      attestations.push(...events);
      relay.close();
    } catch (e) {
      log(`  Error: ${e.message}`);
    }
  }
  
  // Deduplicate
  const unique = [...new Map(attestations.map(e => [e.id, e])).values()];
  log(`\nTotal unique attestations: ${unique.length}\n`);
  
  // Process
  for (const event of unique) {
    const from = event.pubkey;
    const to = event.tags.find(t => t[0] === 'p')?.[1];
    const type = event.tags.find(t => t[0] === 'l' && t[2] === 'ai.wot')?.[1];
    const comment = event.tags.find(t => t[0] === 'comment')?.[1] || '';
    
    if (!to || !type) continue;
    
    if (!nodes.has(from)) nodes.set(from, { pubkey: from, given: 0, received: 0 });
    if (!nodes.has(to)) nodes.set(to, { pubkey: to, given: 0, received: 0 });
    
    nodes.get(from).given++;
    nodes.get(to).received++;
    
    edges.push({
      id: event.id,
      from, to, type, comment,
      timestamp: event.created_at,
      weight: ATTESTATION_TYPES[type]?.weight || 0.5,
      color: ATTESTATION_TYPES[type]?.color || '#888',
    });
  }
  
  // Fetch profiles
  log('Fetching profiles...');
  const pubkeys = [...nodes.keys()];
  
  try {
    const relay = await Relay.connect('wss://relay.damus.io');
    const profiles = await new Promise((resolve) => {
      const collected = [];
      const timeout = setTimeout(() => { sub.close(); resolve(collected); }, 5000);
      const sub = relay.subscribe([{ kinds: [0], authors: pubkeys.slice(0, 100) }], {
        onevent(event) { collected.push(event); },
        oneose() { clearTimeout(timeout); sub.close(); resolve(collected); }
      });
    });
    
    for (const profile of profiles) {
      try {
        const content = JSON.parse(profile.content);
        const node = nodes.get(profile.pubkey);
        if (node) {
          node.name = content.name || content.display_name;
          node.picture = content.picture;
        }
      } catch {}
    }
    relay.close();
  } catch (e) {
    log(`Profile fetch error: ${e.message}`);
  }
  
  const graphData = {
    generated: new Date().toISOString(),
    stats: {
      nodes: nodes.size,
      edges: edges.length,
      attestationTypes: Object.fromEntries(
        Object.entries(ATTESTATION_TYPES).map(([type]) => [
          type, edges.filter(e => e.type === type).length
        ])
      ),
    },
    nodes: [...nodes.values()].map(n => ({
      id: n.pubkey,
      name: n.name || n.pubkey.slice(0, 8) + '...',
      given: n.given,
      received: n.received,
      picture: n.picture,
      size: Math.max(5, Math.min(30, 5 + n.received * 3)),
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.from,
      target: e.to,
      type: e.type,
      comment: e.comment,
      weight: e.weight,
      color: e.color,
    })),
  };
  
  if (output) {
    fs.writeFileSync(output, JSON.stringify(graphData, null, 2));
    log(`\nWrote ${output}`);
  }
  
  // Print top nodes
  log('\n📊 Top nodes by attestations received:');
  [...nodes.values()]
    .sort((a, b) => b.received - a.received)
    .slice(0, 10)
    .forEach((n, i) => {
      log(`  ${i + 1}. ${n.name || n.pubkey.slice(0, 16)} — ${n.received} received, ${n.given} given`);
    });
  
  return graphData;
}

module.exports = { crawl, ATTESTATION_TYPES, DEFAULT_RELAYS };
