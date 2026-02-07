#!/usr/bin/env node
/**
 * wot-graph tests
 */

const assert = require('assert');
const { crawl, createServer, ATTESTATION_TYPES, DEFAULT_RELAYS } = require('./lib');

async function test() {
  console.log('Running wot-graph tests...\n');
  let passed = 0;
  let failed = 0;
  
  // Test exports
  try {
    assert(typeof crawl === 'function', 'crawl should be a function');
    assert(typeof createServer === 'function', 'createServer should be a function');
    assert(typeof ATTESTATION_TYPES === 'object', 'ATTESTATION_TYPES should be an object');
    assert(Array.isArray(DEFAULT_RELAYS), 'DEFAULT_RELAYS should be an array');
    console.log('✓ Exports are correct');
    passed++;
  } catch (e) {
    console.log('✗ Exports:', e.message);
    failed++;
  }
  
  // Test attestation types
  try {
    assert(ATTESTATION_TYPES['service-quality'].weight === 1.5);
    assert(ATTESTATION_TYPES['identity-continuity'].weight === 1.0);
    assert(ATTESTATION_TYPES['general-trust'].weight === 0.8);
    assert(ATTESTATION_TYPES['work-completed'].weight === 1.2);
    console.log('✓ Attestation type weights are correct');
    passed++;
  } catch (e) {
    console.log('✗ Attestation types:', e.message);
    failed++;
  }
  
  // Test crawl (quick, silent)
  try {
    const data = await crawl({ 
      relays: ['wss://relay.damus.io'], 
      output: null, 
      silent: true 
    });
    assert(data.stats, 'Should have stats');
    assert(Array.isArray(data.nodes), 'Should have nodes array');
    assert(Array.isArray(data.edges), 'Should have edges array');
    console.log(`✓ Crawl works (found ${data.stats.nodes} nodes, ${data.stats.edges} edges)`);
    passed++;
  } catch (e) {
    console.log('✗ Crawl:', e.message);
    failed++;
  }
  
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

test().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
