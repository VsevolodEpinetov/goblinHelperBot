const knex = require('../db/knex');
const { getUser, updateUser } = require('../db/helpers');
const SETTINGS = require('../../settings.json');

		// Simple cache to prevent excessive database calls for the same user
		const userUpdateCache = new Map();
		const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
		
		// Rate limiting for individual users (max 1 update per minute per user)
		const userRateLimit = new Map();
		const RATE_LIMIT_TTL = 60 * 1000; // 1 minute
		
		// Debug mode for development
		const DEBUG_MODE = process.env.USER_TRACKER_DEBUG === 'true';

module.exports = async (ctx, next) => {
	try {
		console.log('🔄 UserTracker middleware: Processing context');
		
		// Get user ID from different context types
		const userId = (ctx.from && ctx.from.id) || 
					  (ctx.callbackQuery && ctx.callbackQuery.from && ctx.callbackQuery.from.id) ||
					  (ctx.message && ctx.message.from && ctx.message.from.id);
		
		console.log('🔄 UserTracker middleware: User ID:', userId);
		
		if (DEBUG_MODE) {
			console.log(`[userTracker] Processing context for user: ${userId}`);
			console.log(`[userTracker] Context type:`, Object.keys(ctx).filter(key => ctx[key] && typeof ctx[key] === 'object'));
		}
		
		if (!userId) {
			console.log('🔄 UserTracker middleware: No userId, skipping');
			return next();
		}
		
		// Check rate limiting for this user
		const now = Date.now();
		const userLastUpdate = userRateLimit.get(userId);
		if (userLastUpdate && (now - userLastUpdate) < RATE_LIMIT_TTL) {
			if (DEBUG_MODE) {
				console.log(`[userTracker] Rate limited for user ${userId}`);
			}
			return next();
		}
		
		// Skip if this is a channel post or other non-user content
		if (ctx.channelPost || ctx.editedChannelPost) return next();
		
		// Skip if this is a service message (new chat members, pinned messages, etc.)
		if (ctx.message && (ctx.message.new_chat_members || ctx.message.left_chat_member || 
			ctx.message.pinned_message || ctx.message.delete_chat_photo || 
			ctx.message.new_chat_title || ctx.message.new_chat_photo)) {
			return next();
		}
		
		// Get current user data from database
		const currentUserData = await getUser(userId);
		
		// Get current Telegram user info
		const telegramUser = ctx.from || 
							(ctx.callbackQuery && ctx.callbackQuery.from) || 
							(ctx.message && ctx.message.from);
		
		if (!telegramUser) return next();
		
		// Check if user exists in database
		if (currentUserData) {
			// Check if any user info has changed
			const hasChanges = 
				currentUserData.username !== (telegramUser.username || 'not_set') ||
				currentUserData.first_name !== (telegramUser.first_name || 'not_set') ||
				currentUserData.last_name !== (telegramUser.last_name || '');
			
			// Check cache to prevent excessive updates
			const cacheKey = `${userId}_${telegramUser.username || 'no_username'}_${telegramUser.first_name || 'no_firstname'}_${telegramUser.last_name || 'no_lastname'}`;
			const cached = userUpdateCache.get(cacheKey);
			
			if (DEBUG_MODE) {
				console.log(`[userTracker] User ${userId} has changes:`, {
					username: `${currentUserData.username} → ${telegramUser.username || 'not_set'}`,
					first_name: `${currentUserData.first_name} → ${telegramUser.first_name || 'not_set'}`,
					last_name: `${currentUserData.last_name} → ${telegramUser.last_name || ''}`,
					cached: !!cached
				});
			}
			
			if (hasChanges && !cached) {
				// Log the changes to logs chat
				const oldUsername = currentUserData.username !== 'not_set' ? `@${currentUserData.username}` : currentUserData.first_name;
				const newUsername = telegramUser.username ? `@${telegramUser.username}` : telegramUser.first_name;
				
				const changeLog = `👤 User info updated for ${oldUsername} (${userId}):\n` +
					`Username: ${currentUserData.username !== 'not_set' ? `@${currentUserData.username}` : 'not_set'} → ${telegramUser.username ? `@${telegramUser.username}` : 'not_set'}\n` +
					`First name: ${currentUserData.first_name} → ${telegramUser.first_name || 'not_set'}\n` +
					`Last name: ${currentUserData.last_name} → ${telegramUser.last_name || ''}`;
				
				try {
					await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, changeLog);
				} catch (e) {
					console.log('Failed to send user change log:', e);
				}
				
				// Update user data in database
				const updatedUserData = {
					...currentUserData,
					username: telegramUser.username || 'not_set',
					first_name: telegramUser.first_name || 'not_set',
					last_name: telegramUser.last_name || ''
				};
				
				try {
					await updateUser(userId, updatedUserData);
					
					// Update cache to prevent duplicate updates
					userUpdateCache.set(cacheKey, Date.now());
					
					// Update rate limit for this user
					userRateLimit.set(userId, now);
					
					// Clean up old cache entries
					for (const [key, timestamp] of userUpdateCache.entries()) {
						if (now - timestamp > CACHE_TTL) {
							userUpdateCache.delete(key);
						}
					}
					
					// Clean up old rate limit entries
					for (const [uid, timestamp] of userRateLimit.entries()) {
						if (now - timestamp > RATE_LIMIT_TTL) {
							userRateLimit.delete(uid);
						}
					}
				} catch (e) {
					console.log('Failed to update user data:', e);
				}
			}
		} else {
			// User doesn't exist in database - don't create them automatically
			// Only log the interaction for tracking purposes
			if (DEBUG_MODE) {
				console.log(`[userTracker] User ${userId} doesn't exist in database, skipping auto-creation`);
			}
			
			// Log new user interaction (but don't create user)
			const newUserLog = `🆕 New user interaction (not registered): ${telegramUser.username ? `@${telegramUser.username}` : telegramUser.first_name} (${userId})`;
			try {
				await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, newUserLog);
			} catch (e) {
				console.log('Failed to send new user log:', e);
			}
		}
		
	} catch (error) {
		console.log('❌ Error in userTracker middleware:', error);
		// Even if there's an error, we must call next() to continue the chain
	}
	
	console.log('🔄 UserTracker middleware: Completed, calling next()');
	
	// Always call next() to ensure the middleware chain continues
	try {
		const result = await next();
		console.log('🔄 UserTracker middleware: next() returned:', typeof result);
		return result;
	} catch (error) {
		console.log('❌ Error calling next() in userTracker middleware:', error);
		// Re-throw the error to maintain error propagation
		throw error;
	}
};
