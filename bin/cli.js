#!/usr/bin/env node
/**
 * wot-graph CLI
 * 
 * Commands:
 *   crawl   - Fetch attestations from Nostr relays and generate graph data
 *   serve   - Start the visualization server
 *   live    - Start server with real-time WebSocket updates
 */

const { crawl } = require('../lib/crawler');
const { createServer } = require('../lib/server');

const args = process.argv.slice(2);
const command = args[0] || 'serve';

async function main() {
  switch (command) {
    case 'crawl':
      console.log('🕸️  ai.wot Trust Network Crawler\n');
      const data = await crawl({
        output: args.includes('--output') ? args[args.indexOf('--output') + 1] : './graph-data.json',
        relays: args.includes('--relays') ? args[args.indexOf('--relays') + 1].split(',') : undefined,
      });
      console.log(`\n✓ Generated graph with ${data.stats.nodes} nodes, ${data.stats.edges} edges`);
      break;
      
    case 'serve':
      const port = args.includes('--port') ? parseInt(args[args.indexOf('--port') + 1]) : 8405;
      createServer({ port, live: false });
      break;
      
    case 'live':
      const livePort = args.includes('--port') ? parseInt(args[args.indexOf('--port') + 1]) : 8405;
      createServer({ port: livePort, live: true });
      break;
      
    case 'help':
    default:
      console.log(`
wot-graph - ai.wot Trust Network Visualizer

Commands:
  crawl    Fetch attestations and generate graph-data.json
  serve    Start static visualization server
  live     Start server with real-time WebSocket updates

Options:
  --port <port>     Server port (default: 8405)
  --output <file>   Output file for crawl (default: ./graph-data.json)
  --relays <urls>   Comma-separated relay URLs

Examples:
  wot-graph crawl
  wot-graph serve --port 3000
  wot-graph live
`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
