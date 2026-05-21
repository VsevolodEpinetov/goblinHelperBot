# RPG System Quick Reference

## 📦 Import

```javascript
const { 
  grantXp, 
  hasRank, 
  getUserRank,
  sendRpgNotification 
} = require('./modules/loyalty/rpgUtils');
```

---

## 🎯 Common Use Cases

### Grant XP (Generic)
```javascript
await grantXp(userId, 100, 'admin_grant', {
  reason: 'Помощь с тестированием',
  grantedBy: adminId
});
```

### Grant XP from Stars
```javascript
await grantXpFromStars(userId, 1000, 'subscription', {
  period: '2025_10'
});
```

### Grant XP from Subscription
```javascript
await grantXpFromSubscription(userId, 'plus', {
  period: '2025_10'
});
```

### Check if User Has Rank
```javascript
// Check tier only
if (await hasRank(userId, 'gold')) {
  // User is gold or higher
}

// Check tier + level
if (await hasRank(userId, 'gold', 5)) {
  // User is gold level 5 or higher
}
```

### Get User's Current Rank
```javascript
const rank = await getUserRank(userId);
// rank = {
//   tier: 'gold',
//   tierName: 'Золотой',
//   emoji: '🥇',
//   level: 7,
//   totalXp: 15234,
//   xpToNextLevel: 432,
//   nextTierXp: 20000,
//   tierData: { ... }
// }
```

### Get Full XP Stats
```javascript
const stats = await getUserXpStats(userId);
// Includes rank + weeklyXp + recentTransactions
```

### Send Notification to RPG Topic
```javascript
await sendRpgNotification(
  '🎉 <b>Событие!</b>\n\nДвойной XP в эти выходные!'
);
```

### Get Leaderboard
```javascript
const top10 = await getLeaderboard(10);
// Returns array of { userId, username, totalXp, tier, level, ... }
```

---

## 🔧 Configuration (`configs/rpg.js`)

### Tier Thresholds
```javascript
tiers: [
  { devName: 'wood', minXp: 0, maxXp: 1999 },
  { devName: 'bronze', minXp: 2000, maxXp: 4999 },
  { devName: 'silver', minXp: 5000, maxXp: 9999 },
  { devName: 'gold', minXp: 10000, maxXp: 19999 },
  // ... and so on
]
```

### XP Sources
```javascript
xpSources: {
  stars: { xpPerStar: 5 },
  subscriptions: {
    regular: { baseXp: 600 },
    plus: { baseXp: 1600 }
  },
  messages: { 
    xpPerMessage: 1,
    dailyLimit: 50
  },
  raids: {
    createRaid: 50,
    completeRaid: 100,
    joinRaid: 25
  }
}
```

### Notification Settings
```javascript
notifications: {
  xpGain: {
    enabled: true,
    minXpToNotify: 10
  },
  levelUp: {
    enabled: true,
    sendPrivateMessage: true
  }
}
```

---

## 📊 XP Source Types

Use these strings for the `source` parameter in `grantXp()`:

- `'spending_payment'` - Payment (stars, subscriptions)
- `'admin_grant'` - Admin manually grants XP
- `'raid_create'` - User creates a raid
- `'raid_complete'` - User completes a raid
- `'raid_join'` - User joins a raid
- `'message_activity'` - XP from chat messages
- `'old_month_payment'` - Purchase of old month access
- `'kickstarter_backing'` - Kickstarter support
- `'achievement_unlock'` - Achievement unlocked
- `'admin_payment_confirm'` - Admin confirms payment
- `'admin_kickstarter_confirm'` - Admin confirms kickstarter

---

## 🎖️ Tier Names

| Dev Name | Display Name | Emoji | Min XP | Max XP |
|----------|-------------|-------|--------|--------|
| `wood` | Деревянный | 🪵 | 0 | 1,999 |
| `bronze` | Бронзовый | 🥉 | 2,000 | 4,999 |
| `silver` | Серебряный | 🥈 | 5,000 | 9,999 |
| `gold` | Золотой | 🥇 | 10,000 | 19,999 |
| `platinum` | Платиновый | 💎 | 20,000 | 39,999 |
| `diamond` | Алмазный | 💠 | 40,000 | 79,999 |
| `mithril` | Мифриловый | ⚔️ | 80,000 | 159,999 |
| `legend` | Легендарный | 👑 | 160,000 | ∞ |

---

## 🔍 Database Tables

### `user_levels`
```sql
user_id             bigint     Primary key
current_tier        string     'wood', 'bronze', etc.
current_level       integer    1-10 (legend 1+)
total_xp            integer    Total accumulated XP
total_spending_units decimal   Legacy spending units
xp_to_next_level    integer    XP needed for next level
level_up_date       timestamp  Last level up
created_at          timestamp
updated_at          timestamp
```

### `xp_transactions`
```sql
id          increments  Primary key
user_id     bigint      User who gained/lost XP
amount      integer     XP delta (+/-)
source      string      Source type (see above)
description text        Human-readable description
metadata    jsonb       Additional data
created_at  timestamp   When XP was granted
```

---

## 🚀 Advanced Usage

### Bulk Rank Retrieval (for leaderboards, etc.)
```javascript
const { getBulkUserRanks } = require('./modules/loyalty/rpgUtils');

const userIds = [123, 456, 789];
const ranksMap = await getBulkUserRanks(userIds);

for (const [userId, rank] of ranksMap) {
  console.log(`User ${userId}: ${rank.emoji} ${rank.tierName} ${rank.level}`);
}
```

### Check XP Threshold (instead of rank)
```javascript
const { hasXpThreshold } = require('./modules/loyalty/rpgUtils');

if (await hasXpThreshold(userId, 50000)) {
  // User has at least 50,000 XP
}
```

### Get User's Leaderboard Position
```javascript
const { getUserLeaderboardPosition } = require('./modules/loyalty/rpgUtils');

const position = await getUserLeaderboardPosition(userId);
console.log(`You are rank #${position}`);
```

### Direct XP from Message (with cooldown/limits)
```javascript
const { grantXpFromMessage } = require('./modules/loyalty/rpgUtils');

// Will respect daily limits and cooldowns from config
await grantXpFromMessage(userId, groupId, {
  messageText: ctx.message.text
});
```

---

## 📝 Logging Format

The new system uses a clean, user-friendly log format:

```
[2025-10-03T15:23:45.123Z] [RPG] @username (12345) +100 XP from admin_grant
[2025-10-03T15:24:12.456Z] [RPG] @username (12345) +1600 XP from spending_payment → Level up! 🥈 Серебряный 3 → 🥈 Серебряный 4
[2025-10-03T15:25:00.789Z] [RPG] Drift detected for user 12345: stored=gold 3, calculated=gold 4, XP=12500
```

Follows your preferred format: `timestamp [TAG] @username (id) action details`

---

## ⚠️ Important Notes

1. **Hybrid Approach**: Ranks are stored in DB but validated on every read. If drift is detected, it's auto-fixed.

2. **Backwards Compatible**: Old `xpService.js` functions still work, but are deprecated.

3. **Transaction Logging**: Every XP change is logged to `xp_transactions` table.

4. **Notification Control**: All notifications respect `configs/rpg.js` settings.

5. **Error Handling**: All functions catch errors and return gracefully. Check `.success` field in return object.

---

## 🧪 Testing

### Test XP Grant
```javascript
const result = await grantXp(userId, 100, 'admin_grant', {
  description: 'Test'
});

console.log(result);
// {
//   success: true,
//   deltaXp: 100,
//   newTotalXp: 1234,
//   oldRank: { tier: 'wood', level: 5 },
//   newRank: { tier: 'wood', level: 6 },
//   leveledUp: true
// }
```

### Validate Stored Ranks
```javascript
const knex = require('./modules/db/knex');
const { calculateRankFromXp } = require('./configs/rpg');

const users = await knex('user_levels').select('*');

for (const user of users) {
  const calculated = calculateRankFromXp(user.total_xp);
  if (calculated.tier !== user.current_tier) {
    console.log(`Drift: User ${user.user_id}`);
  }
}
```

---

## 📞 Support

For questions about the RPG system, see:
- **Full Documentation**: `RPG_OVERHAUL.md`
- **Migration Guide**: `MIGRATION_GUIDE.md`
- **Config File**: `configs/rpg.js`
- **Utils Source**: `modules/loyalty/rpgUtils.js`

