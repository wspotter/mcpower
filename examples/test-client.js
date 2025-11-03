#!/usr/bin/env node
/**
 * Simple test client for MCP Power server
 * 
 * Usage: node test-client.js
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

async function main() {
  console.log('🚀 Starting MCP Power test client...\n');

  // Create transport to server
  const transport = new StdioClientTransport({
    command: 'node',
    args: [
      resolve(rootDir, 'dist/cli.js'),
      '--datasets',
      resolve(rootDir, 'datasets'),
      '--log-level',
      'info'
    ]
  });

  // Create MCP client
  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  try {
    // Connect to server
    console.log('📡 Connecting to MCP Power server...');
    await client.connect(transport);
    console.log('✅ Connected successfully\n');

    // List available tools
    console.log('🔧 Available tools:');
    const tools = await client.listTools();
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    console.log();

    // List datasets
    console.log('📚 Listing datasets...');
    const datasetsResult = await client.callTool({
      name: 'knowledge.listDatasets',
      arguments: {}
    });
    console.log(JSON.stringify(JSON.parse(datasetsResult.content[0].text), null, 2));
    console.log();

    // Perform a search
    console.log('🔍 Searching sample-docs for "getting started"...');
    const searchResult = await client.callTool({
      name: 'knowledge.search',
      arguments: {
        dataset: 'sample-docs',
        query: 'How do I get started?',
        topK: 3
      }
    });

    const results = JSON.parse(searchResult.content[0].text);
    console.log(`Found ${results.results.length} results:\n`);
    
    results.results.forEach((result, idx) => {
      console.log(`${idx + 1}. ${result.title} (score: ${result.score.toFixed(3)})`);
      console.log(`   Path: ${result.path}`);
      console.log(`   Snippet: ${result.snippet.substring(0, 100)}...`);
      console.log();
    });

    console.log('✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
