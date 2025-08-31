const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function readJson(filePath) {
	try {
		const text = fs.readFileSync(filePath, 'utf8');
		if (!text || text.trim().length === 0) return {};
		return JSON.parse(text);
	} catch (e) {
		return {};
	}
}

function findLatestBackupDir(rootDir) {
	if (!fs.existsSync(rootDir)) return null;
	const entries = fs.readdirSync(rootDir, { withFileTypes: true })
		.filter(d => d.isDirectory())
		.map(d => d.name)
		.sort()
		.reverse();
	return entries.length ? path.join(rootDir, entries[0]) : null;
}

(async () => {
	const conn = {
		host: process.env.PGHOST || '127.0.0.1',
		port: parseInt(process.env.PGPORT || '5432', 10),
		database: process.env.PGDATABASE || 'goblinhelperbot',
		user: process.env.PGUSER || 'goblinhelper',
		password: process.env.PGPASSWORD || ''
	};
	const client = new Client(conn);
	await client.connect();

	const backupsRoot = path.join(process.cwd(), 'backups');
	const backupDir = process.env.BACKUP_DIR || findLatestBackupDir(backupsRoot);
	if (!backupDir) {
		console.error('No backup dir found at', backupsRoot);
		process.exit(1);
	}
	console.log('Using backup dir:', backupDir);

	const usersRoot = readJson(path.join(backupDir, 'users.json'));
	const monthsRoot = readJson(path.join(backupDir, 'months.json'));
	const ksRoot = readJson(path.join(backupDir, 'kickstarters.json'));
	const settingsRoot = readJson(path.join(backupDir, 'settings.json'));

	const inserted = { users: 0, userPurchases: 0, userRoles: 0, userGroups: 0, userKickstarters: 0, months: 0, kickstarters: 0, ksPhotos: 0, ksFiles: 0, settings: 0 };
	const allowedRoles = new Set(['admin','adminPlus','rejected']);

	// 1) Import kickstarters first
	const ksList = ksRoot.list || ksRoot || [];
	if (Array.isArray(ksList)) {
		for (let i = 0; i < ksList.length; i++) {
			const k = ksList[i];
			if (!k) continue;
			const id = i;
			await client.query(
				'INSERT INTO "kickstarters" (id, name, creator, cost, "pledgeName", "pledgeCost", link) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, creator=EXCLUDED.creator, cost=EXCLUDED.cost, "pledgeName"=EXCLUDED."pledgeName", "pledgeCost"=EXCLUDED."pledgeCost", link=EXCLUDED.link',
				[id, k.name || null, k.creator || null, k.cost || 0, k.pledgeName || null, k.pledgeCost || 0, k.link || null]
			);
			inserted.kickstarters++;
			const photos = Array.isArray(k.photos) ? k.photos : [];
			const files = Array.isArray(k.files) ? k.files : [];
			for (let ord = 0; ord < photos.length; ord++) {
				await client.query('INSERT INTO "kickstarterPhotos" ("kickstarterId", ord, "fileId") VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [id, ord, photos[ord]]);
				inserted.ksPhotos++;
			}
			for (let ord = 0; ord < files.length; ord++) {
				await client.query('INSERT INTO "kickstarterFiles" ("kickstarterId", ord, "fileId") VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [id, ord, files[ord]]);
				inserted.ksFiles++;
			}
		}
	} else if (typeof ksList === 'object') {
		for (const [idStr, k] of Object.entries(ksList)) {
			const id = parseInt(idStr, 10);
			if (!Number.isFinite(id)) continue;
			await client.query(
				'INSERT INTO "kickstarters" (id, name, creator, cost, "pledgeName", "pledgeCost", link) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, creator=EXCLUDED.creator, cost=EXCLUDED.cost, "pledgeName"=EXCLUDED."pledgeName", "pledgeCost"=EXCLUDED."pledgeCost", link=EXCLUDED.link',
				[id, k.name || null, k.creator || null, k.cost || 0, k.pledgeName || null, k.pledgeCost || 0, k.link || null]
			);
			inserted.kickstarters++;
			const photos = Array.isArray(k.photos) ? k.photos : [];
			const files = Array.isArray(k.files) ? k.files : [];
			for (let ord = 0; ord < photos.length; ord++) {
				await client.query('INSERT INTO "kickstarterPhotos" ("kickstarterId", ord, "fileId") VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [id, ord, photos[ord]]);
				inserted.ksPhotos++;
			}
			for (let ord = 0; ord < files.length; ord++) {
				await client.query('INSERT INTO "kickstarterFiles" ("kickstarterId", ord, "fileId") VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [id, ord, files[ord]]);
				inserted.ksFiles++;
			}
		}
	}

	// 2) Import users and relations
	const usersList = usersRoot.list || usersRoot || {};
	for (const [userIdStr, u] of Object.entries(usersList)) {
		const userId = parseInt(userIdStr, 10);
		if (!Number.isFinite(userId)) continue;
		const username = u.username || null;
		const firstName = u.first_name || null;
		const lastName = u.last_name || null;
		await client.query(
			'INSERT INTO "users" (id, username, "firstName", "lastName") VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username, "firstName"=EXCLUDED."firstName", "lastName"=EXCLUDED."lastName"',
			[userId, username, firstName, lastName]
		);
		inserted.users++;

		const purchases = (u.purchases) || {};
		const balance = purchases.balance || 0;
		const ticketsSpent = purchases.ticketsSpent || 0;
		await client.query(
			'INSERT INTO "userPurchases" ("userId", balance, "ticketsSpent") VALUES ($1,$2,$3) ON CONFLICT ("userId") DO UPDATE SET balance=EXCLUDED.balance, "ticketsSpent"=EXCLUDED."ticketsSpent"',
			[userId, balance, ticketsSpent]
		);
		inserted.userPurchases++;

		const roles = Array.isArray(u.roles) ? u.roles : [];
		for (const role of roles) {
			if (!role || !['admin','adminPlus','rejected'].includes(role)) continue;
			await client.query('INSERT INTO "userRoles" ("userId", role) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, role]);
			inserted.userRoles++;
		}

		const groups = (purchases.groups) || {};
		const regular = Array.isArray(groups.regular) ? groups.regular : [];
		const plus = Array.isArray(groups.plus) ? groups.plus : [];
		for (const period of regular) {
			if (!period) continue;
			await client.query('INSERT INTO "userGroups" ("userId", period, type) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [userId, period, 'regular']);
			inserted.userGroups++;
		}
		for (const period of plus) {
			if (!period) continue;
			await client.query('INSERT INTO "userGroups" ("userId", period, type) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [userId, period, 'plus']);
			inserted.userGroups++;
		}

		const userKs = Array.isArray(purchases.kickstarters) ? purchases.kickstarters : [];
		for (const ksIdRaw of userKs) {
			const ksId = parseInt(ksIdRaw, 10);
			if (!Number.isFinite(ksId)) continue;
			await client.query('INSERT INTO "userKickstarters" ("userId", "kickstarterId", "acquiredBy") VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [userId, ksId, 'ticket']);
			inserted.userKickstarters++;
		}
	}

	// 3) Months
	const monthsList = monthsRoot.list || monthsRoot || {};
	for (const [year, monthsByYear] of Object.entries(monthsList)) {
		if (!monthsByYear || typeof monthsByYear !== 'object') continue;
		for (const [month, obj] of Object.entries(monthsByYear)) {
			const period = `${year}_${month}`;
			for (const type of ['regular', 'plus']) {
				const cfg = obj && obj[type];
				if (!cfg) continue;
				const chatId = cfg.id || null;
				const cj = cfg.counter && Number.isFinite(cfg.counter.joined) ? cfg.counter.joined : (cfg.counter && cfg.counter.joined) || 0;
				const cp = cfg.counter && Number.isFinite(cfg.counter.paid) ? cfg.counter.paid : (cfg.counter && cfg.counter.paid) || 0;
				await client.query('INSERT INTO "months" (period, type, "chatId", "counterJoined", "counterPaid") VALUES ($1,$2,$3,$4,$5) ON CONFLICT (period, type) DO UPDATE SET "chatId"=EXCLUDED."chatId", "counterJoined"=EXCLUDED."counterJoined", "counterPaid"=EXCLUDED."counterPaid"', [period, type, chatId, cj, cp]);
				inserted.months++;
			}
		}
	}

	// 4) Settings (optional)
	if (settingsRoot && settingsRoot.current && settingsRoot.current.year && settingsRoot.current.month) {
		const period = `${settingsRoot.current.year}_${settingsRoot.current.month}`;
		await client.query('INSERT INTO "settings" (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value', ['currentPeriod', period]);
		inserted.settings++;
	}

	console.log('Import summary:', inserted);
	const counts = {};
	for (const t of ['users','userPurchases','userRoles','userGroups','userKickstarters','months','kickstarters','kickstarterPhotos','kickstarterFiles','settings']) {
		const r = await client.query(`SELECT COUNT(*)::int AS c FROM "${t}"`);
		counts[t] = r.rows[0].c;
	}
	console.log('Table counts:', counts);

	await client.end();
	process.exit(0);
})();


