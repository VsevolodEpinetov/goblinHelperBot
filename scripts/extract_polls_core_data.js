#!/usr/bin/env node

/**
 * Temporary helper script to extract ctx.polls.core data
 * Add this code temporarily to displayCore.js to get the current data
 * 
 * Add this line in displayCore.js after line 13:
 * console.log('CURRENT CTX.POLLS.CORE DATA:', JSON.stringify(ctx.polls.core, null, 2));
 * 
 * Then run the bot, trigger the admin polls core action, and check the logs
 * Copy the output and paste it into the migrate_polls_core_to_db.js script
 */

console.log(`
🔧 DATA EXTRACTION INSTRUCTIONS:

1. Go to admin polls core menu in Telegram to load ctx.polls.core
2. Use the /ex command to extract the data:
   /ex console.log('CURRENT CTX.POLLS.CORE DATA:', JSON.stringify(ctx.polls.core, null, 2));

3. Check the bot logs for the output
4. Copy the array data and paste it into scripts/migrate_polls_core_to_db.js
5. Run: node scripts/migrate_polls_core_to_db.js

Example output you should see:
CURRENT CTX.POLLS.CORE DATA: [
  "Studio Name 1",
  "Studio Name 2",
  "Studio Name 3"
]
`);
