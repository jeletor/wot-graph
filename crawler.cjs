#!/usr/bin/env node
/**
 * ai.wot Trust Network Crawler
 * 
 * Crawls Nostr relays for ai.wot attestations (kind 1985, L=ai.wot)
 * and builds a trust graph.
 */

const { Relay } = require('nostr-tools/relay');
const { WebSocket } = require('ws');
const fs = require('fs');

// Polyfill WebSocket for Node
global.WebSocket = WebSocket;

const RELAYS = [
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

async function crawl() {
  console.log('🕸️  ai.wot Trust Network Crawler\n');
  
  const attestations = [];
  const nodes = new Map(); // pubkey -> { name, attestationsGiven, attestationsReceived }
  const edges = []; // { from, to, type, comment, timestamp }
  
  for (const relayUrl of RELAYS) {
    console.log(`Connecting to ${relayUrl}...`);
    
    try {
      const relay = await Relay.connect(relayUrl);
      
      const events = await new Promise((resolve, reject) => {
        const collected = [];
        const timeout = setTimeout(() => {
          sub.close();
          resolve(collected);
        }, 10000);
        
        const sub = relay.subscribe([
          {
            kinds: [1985],
            '#L': ['ai.wot'],
            limit: 500,
          }
        ], {
          onevent(event) {
            collected.push(event);
          },
          oneose() {
            clearTimeout(timeout);
            sub.close();
            resolve(collected);
          }
        });
      });
      
      console.log(`  Found ${events.length} attestations`);
      attestations.push(...events);
      relay.close();
      
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  // Deduplicate by event id
  const uniqueAttestations = [...new Map(attestations.map(e => [e.id, e])).values()];
  console.log(`\nTotal unique attestations: ${uniqueAttestations.length}\n`);
  
  // Process attestations
  for (const event of uniqueAttestations) {
    const from = event.pubkey;
    const to = event.tags.find(t => t[0] === 'p')?.[1];
    const type = event.tags.find(t => t[0] === 'l' && t[2] === 'ai.wot')?.[1];
    const comment = event.tags.find(t => t[0] === 'comment')?.[1] || '';
    
    if (!to || !type) continue;
    
    // Track nodes
    if (!nodes.has(from)) {
      nodes.set(from, { pubkey: from, given: 0, received: 0 });
    }
    if (!nodes.has(to)) {
      nodes.set(to, { pubkey: to, given: 0, received: 0 });
    }
    
    nodes.get(from).given++;
    nodes.get(to).received++;
    
    // Track edges
    edges.push({
      from,
      to,
      type,
      comment,
      timestamp: event.created_at,
      weight: ATTESTATION_TYPES[type]?.weight || 0.5,
      color: ATTESTATION_TYPES[type]?.color || '#888',
    });
  }
  
  console.log(`Nodes: ${nodes.size}`);
  console.log(`Edges: ${edges.length}`);
  
  // Fetch profile names where possible
  console.log('\nFetching profiles...');
  const pubkeys = [...nodes.keys()];
  
  try {
    const relay = await Relay.connect('wss://relay.damus.io');
    
    const profiles = await new Promise((resolve, reject) => {
      const collected = [];
      const timeout = setTimeout(() => {
        sub.close();
        resolve(collected);
      }, 5000);
      
      const sub = relay.subscribe([
        {
          kinds: [0],
          authors: pubkeys.slice(0, 100), // Limit to avoid too many
        }
      ], {
        onevent(event) {
          collected.push(event);
        },
        oneose() {
          clearTimeout(timeout);
          sub.close();
          resolve(collected);
        }
      });
    });
    
    for (const profile of profiles) {
      try {
        const content = JSON.parse(profile.content);
        const node = nodes.get(profile.pubkey);
        if (node) {
          node.name = content.name || content.display_name || profile.pubkey.slice(0, 8);
          node.picture = content.picture;
        }
      } catch (e) {}
    }
    
    relay.close();
  } catch (e) {
    console.log(`Profile fetch error: ${e.message}`);
  }
  
  // Build graph data
  const graphData = {
    generated: new Date().toISOString(),
    stats: {
      nodes: nodes.size,
      edges: edges.length,
      attestationTypes: Object.fromEntries(
        Object.entries(ATTESTATION_TYPES).map(([type, info]) => [
          type,
          edges.filter(e => e.type === type).length
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
      source: e.from,
      target: e.to,
      type: e.type,
      comment: e.comment,
      weight: e.weight,
      color: e.color,
    })),
  };
  
  // Write JSON
  fs.writeFileSync('graph-data.json', JSON.stringify(graphData, null, 2));
  console.log('\nWrote graph-data.json');
  
  // Print top nodes
  console.log('\n📊 Top nodes by attestations received:');
  [...nodes.values()]
    .sort((a, b) => b.received - a.received)
    .slice(0, 10)
    .forEach((n, i) => {
      console.log(`  ${i + 1}. ${n.name || n.pubkey.slice(0, 16)} — ${n.received} received, ${n.given} given`);
    });
  
  return graphData;
}

crawl().catch(console.error);
