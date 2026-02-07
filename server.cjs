#!/usr/bin/env node
/**
 * Standalone server (for backward compatibility)
 */
const { createServer } = require('./lib/server');
createServer({ port: process.env.PORT || 8405 });
