#!/usr/bin/env node
import { program } from 'commander';
import { startServer } from './server.js';
import { setLogLevel } from './logger.js';

/**
 * MCP Knowledge Server CLI
 * Entry point with command-line flags
 */

program
  .name('mcpower')
  .description('MCP Knowledge Server - Semantic search over pre-built knowledge datasets')
  .version('0.1.0')
  .option('--stdio', 'Use stdio transport for MCP communication (default)', true)
  .option('--log-level <level>', 'Log level: debug, info, warn, error', 'info')
  .option('--datasets <path>', 'Path to datasets directory', './datasets')
  .action(async (options: { logLevel: string; datasets: string }) => {
    // Set log level
    const logLevel = options.logLevel as 'debug' | 'info' | 'warn' | 'error';
    setLogLevel(logLevel);

    // Start the MCP server
    await startServer({
      transport: 'stdio',
      datasetsPath: options.datasets,
      logLevel
    });
  });

program.parse();
