#!/usr/bin/env node
/**
 * Standalone crawler (for backward compatibility)
 */
const { crawl } = require('./lib/crawler');
crawl({ output: './graph-data.json' }).catch(console.error);
