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
		last_name: user.lastName || 'not_set',
		roles: roles.map(r => r.role),
		purchases: {
			balance: purchases?.balance || 0,
			scrollsSpent: purchases?.scrollsSpent || 0,
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
			last_name: user.lastName || 'not_set',
			roles: [],
			purchases: { 
				balance: 0, 
				scrollsSpent: 0, 
				groups: { regular: [], plus: [] }, 
				kickstarters: [], 
				collections: [] 
			}
		};
	}

	// Load additional data in parallel
	const [purchases, roles, groups, kickstarters] = await Promise.all([
		knex('userPurchases').select('userId', 'balance', 'scrollsSpent'),
		knex('userRoles').select('userId', 'role'),
		knex('userGroups').select('userId', 'period', 'type'),
		knex('userKickstarters').select('userId', 'kickstarterId')
	]);

	// Merge data
	for (const p of purchases) {
		if (usersShape.list[p.userId]) {
			usersShape.list[p.userId].purchases.balance = p.balance || 0;
			usersShape.list[p.userId].purchases.scrollsSpent = p.scrollsSpent || 0;
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
					balance: userData.purchases.balance || 0,
					scrollsSpent: userData.purchases.scrollsSpent || 0
				})
				.onConflict('userId')
				.merge(['balance', 'scrollsSpent']);

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

module.exports = {
	getUser,
	getAllUsers,
	updateUser,
	getMonths,
	updateMonth,
	getKickstarters,
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
	knex
};
