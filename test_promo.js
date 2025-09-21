// Test script to verify promo command registration
const promoCommands = require('./modules/admin/commands/promoManagement');

console.log('Testing promo commands...');
console.log('promoCommands type:', typeof promoCommands);
console.log('promoCommands constructor:', promoCommands.constructor.name);

// Test if the commands are properly registered
const bot = require('telegraf');
const testBot = new bot.Telegraf('test');
testBot.use(promoCommands);

console.log('Commands registered successfully!');
