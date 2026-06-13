import { Telegraf } from 'telegraf';

import { getConfig } from './config';

/**
 * Single Telegraf instance. Anyone needing `bot.telegram.xxx` imports from here.
 * Replaces the legacy `globalThis.__bot` pattern.
 */
export const bot = new Telegraf(getConfig().botToken);
