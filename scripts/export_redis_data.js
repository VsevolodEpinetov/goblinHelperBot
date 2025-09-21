#!/usr/bin/env node

/**
 * Redis Data Export Script
 * 
 * This script exports all data from the Redis database on the server.
 * It will create JSON files for all the data that was previously stored in Redis.
 * 
 * Usage:
 *   node scripts/export_redis_data.js
 *   
 * Environment variables (optional):
 *   REDIS_HOST - Redis host (default: localhost)
 *   REDIS_PORT - Redis port (default: 6379)
 *   REDIS_PASSWORD - Redis password (default: none)
 *   REDIS_DB - Redis database number (default: 0)
 *   EXPORT_DIR - Directory to save exports (default: ./backups/redis_export_YYYYMMDD_HHMMSS)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Use the Redis client from telegraf-session-redis-upd (Redis v2.x API)
const redis = require('telegraf-session-redis-upd/node_modules/redis');

// Configuration
const config = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10)
};

// Create export directory with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const exportDir = process.env.EXPORT_DIR || path.join(process.cwd(), 'backups', `redis_export_${timestamp}`);
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

console.log('Redis Export Configuration:');
console.log(`Host: ${config.host}:${config.port}`);
console.log(`Database: ${config.db}`);
console.log(`Password: ${config.password ? '[SET]' : '[NOT SET]'}`);
console.log(`Export Directory: ${exportDir}`);
console.log('');

// Create Redis client (Redis v2.x API)
const client = redis.createClient({
  host: config.host,
  port: config.port,
  password: config.password,
  db: config.db,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      console.error('Redis connection refused. Is Redis running?');
      process.exit(1);
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      console.error('Redis retry time exhausted');
      process.exit(1);
    }
    if (options.attempt > 10) {
      console.error('Redis max retry attempts reached');
      process.exit(1);
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

// Handle Redis errors
client.on('error', (err) => {
  console.error('Redis Client Error:', err);
  process.exit(1);
});

client.on('connect', () => {
  console.log('Connected to Redis successfully');
});

// Helper function to get all keys matching a pattern
async function getAllKeys(pattern = '*') {
  return new Promise((resolve, reject) => {
    client.keys(pattern, (err, keys) => {
      if (err) {
        reject(err);
      } else {
        resolve(keys);
      }
    });
  });
}

// Helper function to get key type and value
async function getKeyData(key) {
  return new Promise((resolve, reject) => {
    client.type(key, (err, type) => {
      if (err) return reject(err);
      
      switch (type) {
        case 'string':
          client.get(key, (err, value) => {
            if (err) return reject(err);
            resolve({ type, value });
          });
          break;
          
        case 'list':
          client.lrange(key, 0, -1, (err, value) => {
            if (err) return reject(err);
            resolve({ type, value });
          });
          break;
          
        case 'set':
          client.smembers(key, (err, value) => {
            if (err) return reject(err);
            resolve({ type, value });
          });
          break;
          
        case 'zset':
          client.zrange(key, 0, -1, 'WITHSCORES', (err, value) => {
            if (err) return reject(err);
            resolve({ type, value });
          });
          break;
          
        case 'hash':
          client.hgetall(key, (err, value) => {
            if (err) return reject(err);
            resolve({ type, value });
          });
          break;
          
        default:
          resolve({ type, value: null });
      }
    });
  });
}

// Helper function to parse JSON safely
function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}

// Export specific data types based on the old Redis structure
async function exportSpecificData() {
  console.log('Exporting specific data types...');
  
  const exports = {
    users: {},
    months: {},
    kickstarters: {},
    settings: {},
    sessions: {},
    other: {}
  };
  
  try {
    const allKeys = await getAllKeys();
    console.log(`Found ${allKeys.length} keys in Redis`);
    
    for (const key of allKeys) {
      try {
        const keyData = await getKeyData(key);
        let parsedValue = keyData.value;
        
        // Try to parse JSON values
        if (keyData.type === 'string' && typeof parsedValue === 'string') {
          parsedValue = safeParseJSON(parsedValue);
        }
        
        // Categorize keys based on their names
        if (key.includes('users') || key.includes('user')) {
          exports.users[key] = { type: keyData.type, data: parsedValue };
        } else if (key.includes('month')) {
          exports.months[key] = { type: keyData.type, data: parsedValue };
        } else if (key.includes('kickstarter')) {
          exports.kickstarters[key] = { type: keyData.type, data: parsedValue };
        } else if (key.includes('setting')) {
          exports.settings[key] = { type: keyData.type, data: parsedValue };
        } else if (key.includes('session') || key.includes('global') || key.includes('channel') || key.includes('poll')) {
          exports.sessions[key] = { type: keyData.type, data: parsedValue };
        } else {
          exports.other[key] = { type: keyData.type, data: parsedValue };
        }
        
        process.stdout.write('.');
      } catch (err) {
        console.error(`\nError processing key ${key}:`, err.message);
      }
    }
    
    console.log('\n');
    
    // Save categorized exports
    for (const [category, data] of Object.entries(exports)) {
      if (Object.keys(data).length > 0) {
        const filePath = path.join(exportDir, `${category}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Exported ${Object.keys(data).length} ${category} entries to ${filePath}`);
      }
    }
    
    return exports;
    
  } catch (err) {
    console.error('Error during export:', err);
    throw err;
  }
}

// Export raw Redis data
async function exportRawData() {
  console.log('Exporting raw Redis data...');
  
  try {
    const allKeys = await getAllKeys();
    const rawData = {};
    
    for (const key of allKeys) {
      const keyData = await getKeyData(key);
      rawData[key] = keyData;
      process.stdout.write('.');
    }
    
    console.log('\n');
    
    const filePath = path.join(exportDir, 'raw_redis_data.json');
    fs.writeFileSync(filePath, JSON.stringify(rawData, null, 2));
    console.log(`Exported ${allKeys.length} raw keys to ${filePath}`);
    
    return rawData;
    
  } catch (err) {
    console.error('Error during raw export:', err);
    throw err;
  }
}

// Generate summary report
function generateSummaryReport(exports) {
  const summary = {
    export_timestamp: new Date().toISOString(),
    redis_config: config,
    export_directory: exportDir,
    summary: {}
  };
  
  for (const [category, data] of Object.entries(exports)) {
    summary.summary[category] = {
      key_count: Object.keys(data).length,
      total_size_bytes: JSON.stringify(data).length
    };
  }
  
  const summaryPath = path.join(exportDir, 'export_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  
  console.log('\n=== EXPORT SUMMARY ===');
  console.log(`Export completed at: ${summary.export_timestamp}`);
  console.log(`Export directory: ${exportDir}`);
  console.log('\nData breakdown:');
  for (const [category, info] of Object.entries(summary.summary)) {
    console.log(`  ${category}: ${info.key_count} keys (${Math.round(info.total_size_bytes / 1024)} KB)`);
  }
  console.log(`\nSummary saved to: ${summaryPath}`);
}

// Main execution
async function main() {
  try {
    console.log('Starting Redis data export...\n');
    
    // Connect to Redis (Redis v2.x API)
    await new Promise((resolve, reject) => {
      client.on('connect', resolve);
      client.on('error', reject);
    });
    
    // Test connection
    await new Promise((resolve, reject) => {
      client.ping((err, result) => {
        if (err) reject(err);
        else {
          console.log(`Redis ping response: ${result}`);
          resolve();
        }
      });
    });
    
    // Export data
    const exports = await exportSpecificData();
    await exportRawData();
    
    // Generate summary
    generateSummaryReport(exports);
    
    console.log('\n✅ Redis export completed successfully!');
    
  } catch (err) {
    console.error('\n❌ Redis export failed:', err.message);
    process.exit(1);
  } finally {
    client.quit();
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, config };
