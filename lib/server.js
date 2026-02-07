/**
 * wot-graph Server
 * 
 * Static file server with optional WebSocket for real-time updates.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const { Relay } = require('nostr-tools/relay');
const { ATTESTATION_TYPES, DEFAULT_RELAYS } = require('./crawler');

global.WebSocket = WebSocket;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function createServer(options = {}) {
  const port = options.port || 8405;
  const live = options.live || false;
  const publicDir = options.publicDir || path.join(__dirname, '..', 'public');
  
  // HTTP server
  const server = http.createServer((req, res) => {
    // API endpoint for graph data
    if (req.url === '/api/graph') {
      const dataPath = path.join(process.cwd(), 'graph-data.json');
      if (fs.existsSync(dataPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(fs.readFileSync(dataPath));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'No graph data. Run: wot-graph crawl' }));
      }
      return;
    }
    
    // Static files
    let filePath = req.url === '/' ? '/index.html' : req.url;
    
    // Try public dir first, then root
    let fullPath = path.join(publicDir, filePath);
    if (!fs.existsSync(fullPath)) {
      fullPath = path.join(__dirname, '..', filePath);
    }
    
    const ext = path.extname(fullPath);
    const contentType = MIME_TYPES[ext] || 'text/plain';
    
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
  
  // WebSocket for live updates
  let wss = null;
  let relayConnections = [];
  
  if (live) {
    wss = new WebSocketServer({ server });
    
    wss.on('connection', (ws) => {
      console.log('Client connected');
      ws.send(JSON.stringify({ type: 'connected', live: true }));
    });
    
    // Subscribe to Nostr relays for live attestations
    startLiveSubscription(wss);
  }
  
  server.listen(port, () => {
    console.log(`🕸️  ai.wot Trust Graph Viewer`);
    console.log(`   http://localhost:${port}`);
    if (live) {
      console.log(`   WebSocket: ws://localhost:${port} (real-time updates)`);
    }
  });
  
  return server;
}

async function startLiveSubscription(wss) {
  console.log('Starting live Nostr subscription...');
  
  const since = Math.floor(Date.now() / 1000) - 3600; // Last hour
  
  for (const relayUrl of DEFAULT_RELAYS.slice(0, 2)) {
    try {
      const relay = await Relay.connect(relayUrl);
      console.log(`  Connected to ${relayUrl}`);
      
      relay.subscribe([
        { kinds: [1985], '#L': ['ai.wot'], since }
      ], {
        onevent(event) {
          const to = event.tags.find(t => t[0] === 'p')?.[1];
          const type = event.tags.find(t => t[0] === 'l' && t[2] === 'ai.wot')?.[1];
          
          if (!to || !type) return;
          
          const attestation = {
            type: 'attestation',
            id: event.id,
            from: event.pubkey,
            to,
            attestationType: type,
            timestamp: event.created_at,
            color: ATTESTATION_TYPES[type]?.color || '#888',
          };
          
          // Broadcast to all connected clients
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(attestation));
            }
          });
        }
      });
    } catch (e) {
      console.log(`  Failed to connect to ${relayUrl}: ${e.message}`);
    }
  }
}

module.exports = { createServer };
