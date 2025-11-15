const knex = require('./knex');

/**
 * Database helper functions for direct Knex queries
 * Replaces the bridge middleware with on-demand data loading
 */

// User-related functions
async function getUser(userId) {
	const user = await knex('users').where('id', userId).first();
	if (!user) return null;

	const [purchases, roles, regularGroups, plusGroups, kickstarters] = await Promise.all([
		knex('userPurchases').where('userId', userId).first(),
		knex('userRoles').where('userId', userId).select('role'),
		knex('userGroups').where('userId', userId).where('type', 'regular').select('period'),
		knex('userGroups').where('userId', userId).where('type', 'plus').select('period'),
		knex('userKickstarters').where('userId', userId).select('kickstarterId')
	]);

	return {
		id: user.id,
		username: user.username || 'not_set',
		first_name: user.firstName || 'not_set',
		last_name: user.lastName || '',
		roles: roles.map(r => r.role),
		purchases: {
			balance: purchases?.balance || 0,
			groups: {
				regular: regularGroups.map(g => g.period),
				plus: plusGroups.map(g => g.period)
			},
			kickstarters: kickstarters.map(k => String(k.kickstarterId)),
			collections: []
		}
	};
}

async function getAllUsers() {
	const users = await knex('users').select('id', 'username', 'firstName', 'lastName');
	const usersShape = { list: {} };

	for (const user of users) {
		usersShape.list[user.id] = {
			id: user.id,
			username: user.username || 'not_set',
			first_name: user.firstName || 'not_set',
			last_name: user.lastName || '',
			roles: [],
			purchases: { 
				balance: 0, 
				groups: { regular: [], plus: [] }, 
				kickstarters: [], 
				collections: [] 
			}
		};
	}

	// Load additional data in parallel
	const [purchases, roles, groups, kickstarters] = await Promise.all([
		knex('userPurchases').select('userId', 'balance'),
		knex('userRoles').select('userId', 'role'),
		knex('userGroups').select('userId', 'period', 'type'),
		knex('userKickstarters').select('userId', 'kickstarterId')
	]);

	// Merge data
	for (const p of purchases) {
		if (usersShape.list[p.userId]) {
			usersShape.list[p.userId].purchases.balance = p.balance || 0;
		}
	}

	for (const r of roles) {
		if (usersShape.list[r.userId]) {
			usersShape.list[r.userId].roles.push(r.role);
		}
	}

	for (const g of groups) {
		if (usersShape.list[g.userId]) {
			if (g.type === 'regular') {
				usersShape.list[g.userId].purchases.groups.regular.push(g.period);
			} else if (g.type === 'plus') {
				usersShape.list[g.userId].purchases.groups.plus.push(g.period);
			}
		}
	}

	for (const k of kickstarters) {
		if (usersShape.list[k.userId]) {
			usersShape.list[k.userId].purchases.kickstarters.push(String(k.kickstarterId));
		}
	}

	return usersShape;
}

async function updateUser(userId, userData) {
	await knex.transaction(async (trx) => {
		// Update basic user info
		await trx('users')
			.insert({
				id: userId,
				username: userData.username,
				firstName: userData.first_name,
				lastName: userData.last_name
			})
			.onConflict('id')
			.merge(['username', 'firstName', 'lastName']);

		// Update purchases
		if (userData.purchases) {
			await trx('userPurchases')
				.insert({
					userId: userId,
					balance: userData.purchases.balance || 0
				})
				.onConflict('userId')
				.merge(['balance']);

			// Update roles (replace all)
			await trx('userRoles').where('userId', userId).del();
			if (userData.roles && userData.roles.length > 0) {
				const roleInserts = userData.roles.map(role => ({ userId, role }));
				await trx('userRoles').insert(roleInserts);
			}

			// Update groups (replace all)
			await trx('userGroups').where('userId', userId).del();
			const groupInserts = [];
			if (userData.purchases.groups?.regular) {
				groupInserts.push(...userData.purchases.groups.regular.map(period => ({ userId, period, type: 'regular' })));
			}
			if (userData.purchases.groups?.plus) {
				groupInserts.push(...userData.purchases.groups.plus.map(period => ({ userId, period, type: 'plus' })));
			}
			if (groupInserts.length > 0) {
				await trx('userGroups').insert(groupInserts);
			}

			// Update kickstarters (replace all)
			await trx('userKickstarters').where('userId', userId).del();
			if (userData.purchases.kickstarters && userData.purchases.kickstarters.length > 0) {
				const ksInserts = userData.purchases.kickstarters
					.map(ksId => ({ userId, kickstarterId: parseInt(ksId, 10) }))
					.filter(k => Number.isFinite(k.kickstarterId));
				if (ksInserts.length > 0) {
					await trx('userKickstarters').insert(ksInserts);
				}
			}
		}
	});
}

// Month-related functions
async function getMonths() {
	const months = await knex('months').select('period', 'type', 'chatId', 'counterJoined', 'counterPaid');
	const monthsShape = { list: {} };

	for (const row of months) {
		const [year, month] = row.period.split('_');
		if (!monthsShape.list[year]) monthsShape.list[year] = {};
		if (!monthsShape.list[year][month]) monthsShape.list[year][month] = {};
		
		monthsShape.list[year][month][row.type] = {
			id: row.chatId || '',
			link: '',
			counter: { 
				joined: row.counterJoined || 0, 
				paid: row.counterPaid || 0 
			}
		};
	}

	// Get invitation links for all periods
	const links = await knex('invitationLinks')
		.select('groupPeriod', 'groupType', 'telegramInviteLink')
		.whereNull('userId') // Group links only
		.whereNotNull('telegramInviteLink');

	for (const link of links) {
		const [year, month] = link.groupPeriod.split('_');
		if (monthsShape.list[year] && monthsShape.list[year][month] && monthsShape.list[year][month][link.groupType]) {
			monthsShape.list[year][month][link.groupType].link = link.telegramInviteLink || '';
		}
	}

	return monthsShape;
}

async function updateMonth(period, type, data) {
	await knex('months')
		.insert({
			period,
			type,
			chatId: data.id || null,
			counterJoined: data.counter?.joined || 0,
			counterPaid: data.counter?.paid || 0
		})
		.onConflict(['period', 'type'])
		.merge(['chatId', 'counterJoined', 'counterPaid']);
}

// Kickstarter-related functions
async function getKickstarters() {
	const kickstarters = await knex('kickstarters')
		.select('id', 'name', 'creator', 'cost', 'pledgeName', 'pledgeCost', 'link')
		.orderBy('id');

	const ksShape = { list: [] };
	
	for (const ks of kickstarters) {
		ksShape.list[ks.id] = {
			name: ks.name,
			creator: ks.creator,
			cost: ks.cost,
			pledgeName: ks.pledgeName,
			pledgeCost: ks.pledgeCost,
			link: ks.link,
			photos: [],
			files: []
		};
	}

	// Load photos and files
	const [photos, files] = await Promise.all([
		knex('kickstarterPhotos').select('kickstarterId', 'ord', 'fileId').orderBy(['kickstarterId', 'ord']),
		knex('kickstarterFiles').select('kickstarterId', 'ord', 'fileId').orderBy(['kickstarterId', 'ord'])
	]);

	for (const photo of photos) {
		if (ksShape.list[photo.kickstarterId]) {
			ksShape.list[photo.kickstarterId].photos[photo.ord] = photo.fileId;
		}
	}

	for (const file of files) {
		if (ksShape.list[file.kickstarterId]) {
			ksShape.list[file.kickstarterId].files[file.ord] = file.fileId;
		}
	}

	return ksShape;
}

// Settings functions
async function getSetting(key) {
	const result = await knex('settings').where('key', key).first();
	return result?.value || null;
}

async function setSetting(key, value) {
	await knex('settings')
		.insert({ key, value })
		.onConflict('key')
		.merge(['value']);
}

// Helper function to find month by chat ID
async function findMonthByChatId(chatId) {
	const result = await knex('months')
		.select('period', 'type')
		.where('chatId', chatId)
		.first();
	
	if (!result) return null;
	
	const [year, month] = result.period.split('_');
	return { year, month, type: result.type };
}

// Helper function to check if user has purchased a month
async function hasUserPurchasedMonth(userId, year, month, type) {
	const result = await knex('userGroups')
		.where('userId', userId)
		.where('period', `${year}_${month}`)
		.where('type', type)
		.first();
	
	return !!result;
}

// Helper function to increment month counter
async function incrementMonthCounter(year, month, type, counterType) {
	const period = `${year}_${month}`;
	const field = counterType === 'joined' ? 'counterJoined' : 'counterPaid';
	
	await knex('months')
		.where('period', period)
		.where('type', type)
		.increment(field, 1);
}

// Helper function to get month chat ID
async function getMonthChatId(year, month, type) {
	const result = await knex('months')
		.select('chatId')
		.where('period', `${year}_${month}`)
		.where('type', type)
		.first();
	
	return result?.chatId;
}

// Helper function to add user to group
async function addUserToGroup(userId, year, month, groupType) {
	const period = `${year}_${month}`;
	await knex('userGroups')
		.insert({ userId: Number(userId), period, type: groupType })
		.onConflict(['userId','period','type']).ignore();
}

// Helper function to add user kickstarter purchase
async function addUserKickstarter(userId, kickstarterId) {
	await knex('userKickstarters')
		.insert({ userId: Number(userId), kickstarterId: Number(kickstarterId) })
		.onConflict(['userId','kickstarterId']).ignore();
}

// Helper function to check if user has purchased kickstarter
async function hasUserPurchasedKickstarter(userId, kickstarterId) {
	const result = await knex('userKickstarters')
		.where('userId', userId)
		.where('kickstarterId', kickstarterId)
		.first();
	return !!result;
}

// Helper function to get kickstarter by ID
async function getKickstarter(kickstarterId) {
	const ks = await knex('kickstarters')
		.select('id', 'name', 'creator', 'cost', 'pledgeName', 'pledgeCost', 'link')
		.where('id', kickstarterId)
		.first();
	
	if (!ks) return null;
	
	const [photos, files] = await Promise.all([
		knex('kickstarterPhotos').select('ord', 'fileId').where('kickstarterId', kickstarterId).orderBy('ord'),
		knex('kickstarterFiles').select('ord', 'fileId').where('kickstarterId', kickstarterId).orderBy('ord')
	]);
	
	return {
		name: ks.name,
		creator: ks.creator,
		cost: ks.cost,
		pledgeName: ks.pledgeName,
		pledgeCost: ks.pledgeCost,
		link: ks.link,
		photos: photos.map(p => p.fileId),
		files: files.map(f => f.fileId)
	};
}

// Helper function to add kickstarter to database
async function addKickstarter(kickstarterData) {
	const trx = await knex.transaction();
	
	try {
		// Get max ID before insert to help identify the new record
		const maxIdBefore = await trx('kickstarters').max('id as maxId').first();
		const maxIdValue = maxIdBefore?.maxId || 0;
		
		// Insert main kickstarter record
		// Note: Some PostgreSQL setups don't support .returning() properly
		// So we insert and then query for the ID
		await trx('kickstarters').insert({
			name: kickstarterData.name,
			creator: kickstarterData.creator,
			link: kickstarterData.link,
			cost: kickstarterData.cost,
			pledgeName: kickstarterData.pledgeName,
			pledgeCost: kickstarterData.pledgeCost
		});
		
		// Query for the inserted record to get the ID
		// First try to find by ID > maxId (should be the new record)
		let inserted = await trx('kickstarters')
			.where('id', '>', maxIdValue)
			.where('name', kickstarterData.name)
			.where('creator', kickstarterData.creator)
			.orderBy('id', 'desc')
			.first();
		
		// Fallback: if that doesn't work, just get the most recent matching record
		if (!inserted || !inserted.id) {
			inserted = await trx('kickstarters')
				.where('name', kickstarterData.name)
				.where('creator', kickstarterData.creator)
				.where('link', kickstarterData.link || '')
				.orderBy('id', 'desc')
				.first();
		}
		
		if (!inserted || !inserted.id) {
			throw new Error('Failed to get kickstarter ID after insert');
		}
		
		const kickstarterId = inserted.id;
		
		// Insert photos if any
		if (kickstarterData.photos && kickstarterData.photos.length > 0) {
			const photoInserts = kickstarterData.photos.map((fileId, index) => ({
				kickstarterId: kickstarterId,
				ord: index + 1,
				fileId: fileId
			}));
			await trx('kickstarterPhotos').insert(photoInserts);
		}
		
		// Insert files if any
		if (kickstarterData.files && kickstarterData.files.length > 0) {
			const fileInserts = kickstarterData.files.map((fileId, index) => ({
				kickstarterId: kickstarterId,
				ord: index + 1,
				fileId: fileId
			}));
			await trx('kickstarterFiles').insert(fileInserts);
		}
		
		await trx.commit();
		return kickstarterId;
	} catch (error) {
		await trx.rollback();
		throw error;
	}
}

// Helper function to update kickstarter price
async function updateKickstarterPrice(kickstarterId, newPrice) {
	await knex('kickstarters')
		.where('id', kickstarterId)
		.update({ cost: newPrice });
	
	return true;
}

// Helper function to get all kickstarters with current prices
async function getAllKickstartersWithPrices() {
	const kickstarters = await knex('kickstarters')
		.select('id', 'name', 'creator', 'cost', 'pledgeName', 'pledgeCost', 'link')
		.orderBy('id');
	
	return kickstarters;
}

// Kickstarter promo messages functions
async function saveKickstarterPromoMessage(kickstarterId, messageId, chatId, topicId = null) {
	await knex('kickstarterPromoMessages').insert({
		kickstarterId: Number(kickstarterId),
		messageId: Number(messageId),
		chatId: Number(chatId),
		topicId: topicId ? Number(topicId) : null
	});
}

async function getKickstarterPromoMessages(kickstarterId) {
	return await knex('kickstarterPromoMessages')
		.where('kickstarterId', Number(kickstarterId))
		.select('*')
		.orderBy('createdAt', 'desc');
}

async function updateKickstarterPromoMessage(id, messageId, chatId, topicId = null) {
	await knex('kickstarterPromoMessages')
		.where('id', Number(id))
		.update({
			messageId: Number(messageId),
			chatId: Number(chatId),
			topicId: topicId ? Number(topicId) : null,
			updatedAt: knex.fn.now()
		});
}

async function deleteKickstarterPromoMessage(id) {
	await knex('kickstarterPromoMessages')
		.where('id', Number(id))
		.del();
}

module.exports = {
	getUser,
	getAllUsers,
	updateUser,
	getMonths,
	updateMonth,
	getKickstarters,
	addKickstarter,
	updateKickstarterPrice,
	getAllKickstartersWithPrices,
	getSetting,
	setSetting,
	findMonthByChatId,
	hasUserPurchasedMonth,
	incrementMonthCounter,
	getMonthChatId,
	addUserToGroup,
	addUserKickstarter,
	hasUserPurchasedKickstarter,
	getKickstarter,
	saveKickstarterPromoMessage,
	getKickstarterPromoMessages,
	updateKickstarterPromoMessage,
	deleteKickstarterPromoMessage,
	knex
};
