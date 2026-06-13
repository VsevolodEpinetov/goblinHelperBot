# Migration Guide: Old XP System → New RPG Utils

## Overview

This guide shows how to migrate from the old `xpService.js` functions to the new `rpgUtils.js` system.

## Key Changes

### 1. **Configuration**
- ✅ **Before**: Hardcoded tier thresholds and XP formulas in `xpService.js`
- ✅ **After**: Everything configurable in `configs/rpg.js`

### 2. **Calculation Approach**
- ✅ **Before**: Store rank + recalculate on XP change
- ✅ **After**: Hybrid approach (store + validate on read)

### 3. **Function Names**
- ✅ **Before**: `applyXpGain()`, `applyDirectXp()`
- ✅ **After**: `grantXp()`, `grantXpFromStars()`, `grantXpFromSubscription()`

---

## Migration Examples

### Example 1: Granting XP from Payment

**Before (old xpService.js):**
```javascript
const { applyXpGain, getSubscriptionBaseUnits } = require('../loyalty/xpService');

// In payment processor
const baseUnits = getSubscriptionBaseUnits('plus'); // Returns 1600
await applyXpGain(userId, baseUnits, 'spending_payment', {
  subscriptionType: 'plus',
  period: '2025_10'
});
```

**After (new rpgUtils.js):**
```javascript
const { grantXpFromSubscription } = require('../loyalty/rpgUtils');

// In payment processor
await grantXpFromSubscription(userId, 'plus', {
  period: '2025_10',
  starsSpent: 1000
});
```

---

### Example 2: Granting XP from Stars Directly

**Before:**
```javascript
// Calculate XP from stars manually
const xpAmount = Math.floor(starsSpent * 5); // Hardcoded conversion
await applyDirectXp(userId, xpAmount, 'spending_payment', {
  starsSpent
});
```

**After:**
```javascript
const { grantXpFromStars } = require('../loyalty/rpgUtils');

// Conversion rate comes from config
await grantXpFromStars(userId, starsSpent, 'subscription', {
  period: '2025_10'
});
```

---

### Example 3: Checking User Rank

**Before:**
```javascript
const { getTierAndLevel } = require('../loyalty/xpService');
const knex = require('../db/knex');

const userRow = await knex('user_levels').where('user_id', userId).first();
const { tier, level } = getTierAndLevel(userRow.total_xp);

if (tier === 'gold' && level >= 5) {
  // Grant access
}
```

**After:**
```javascript
const { hasRank } = require('../loyalty/rpgUtils');

// Simple one-liner
if (await hasRank(userId, 'gold', 5)) {
  // Grant access
}
```

---

### Example 4: Admin Granting XP

**Before:**
```javascript
const { applyDirectXp } = require('../loyalty/xpService');

// Admin grants 500 XP
await applyDirectXp(userId, 500, 'admin_grant', {
  description: 'Помощь с тестированием'
});
```

**After:**
```javascript
const { grantXp } = require('../loyalty/rpgUtils');

// Same functionality, cleaner naming
await grantXp(userId, 500, 'admin_grant', {
  description: 'Помощь с тестированием',
  grantedBy: adminUserId
});
```

---

### Example 5: Getting User's Rank Info

**Before:**
```javascript
const knex = require('../db/knex');
const { getTierAndLevel } = require('../loyalty/xpService');

const userRow = await knex('user_levels').where('user_id', userId).first();
const { tier, level, nextLevelAt } = getTierAndLevel(userRow.total_xp);

console.log(`User is ${tier} level ${level}, needs ${nextLevelAt - userRow.total_xp} XP`);
```

**After:**
```javascript
const { getUserRank } = require('../loyalty/rpgUtils');

const rank = await getUserRank(userId);
console.log(`User is ${rank.emoji} ${rank.tierName} level ${rank.level}, needs ${rank.xpToNextLevel} XP`);
```

---

### Example 6: Leaderboard

**Before:**
```javascript
const knex = require('../db/knex');

const topUsers = await knex('user_levels')
  .join('users', 'user_levels.user_id', 'users.id')
  .orderBy('total_xp', 'desc')
  .limit(10);
// ... manual formatting
```

**After:**
```javascript
const { getLeaderboard } = require('../loyalty/rpgUtils');

const topUsers = await getLeaderboard(10);
// Returns fully formatted array with tier names, emojis, etc.
```

---

### Example 7: Sending RPG Notifications

**Before:**
```javascript
if (notifications.rpgTopicId && notifications.mainGroupId) {
  await globalThis.__bot?.telegram.sendMessage(
    notifications.mainGroupId,
    rpgMessage,
    { 
      parse_mode: 'HTML',
      message_thread_id: notifications.rpgTopicId
    }
  );
}
```

**After:**
```javascript
const { sendRpgNotification } = require('../loyalty/rpgUtils');

await sendRpgNotification('🎉 <b>Событие!</b>\n\nДвойной XP в эти выходные!');
```

---

## File-by-File Migration Checklist

### ✅ `modules/payments/subscriptionPaymentService.js`

**Replace:**
```javascript
const { getSubscriptionBaseUnits, applyXpGain } = require('../loyalty/xpService');
```

**With:**
```javascript
const { grantXpFromSubscription } = require('../loyalty/rpgUtils');
```

**Update calls:**
```javascript
// OLD:
const baseUnits = getSubscriptionBaseUnits(subscriptionType);
await applyXpGain(userId, baseUnits, 'spending_payment', { ... });

// NEW:
await grantXpFromSubscription(userId, subscriptionType, { ... });
```

---

### ✅ `modules/payments/oldMonthPaymentService.js`

**Update XP granting:**
```javascript
// OLD:
await applyXpGain(userId, 300, 'spending_payment', { old_month: true });

// NEW:
const { grantXp } = require('../loyalty/rpgUtils');
await grantXp(userId, 300, 'old_month_payment', { 
  period: monthPeriod,
  description: 'Доступ к старому месяцу'
});
```

---

### ✅ `modules/raids/actions/handlers.js`

**Update raid XP:**
```javascript
// OLD:
await applyDirectXp(userId, 100, 'raid_complete', { raidId });

// NEW:
const { grantXp } = require('../loyalty/rpgUtils');
await grantXp(userId, 100, 'raid_complete', { 
  raidId,
  description: 'Завершение рейда'
});
```

---

### ✅ `modules/loyalty/commands/profile.js`

**Update profile display:**
```javascript
// OLD:
const loyalty = await getUserLoyalty(userId);
const levelInfo = getLevelInfo(loyalty.level);

// NEW:
const { getUserRank, getUserXpStats } = require('../rpgUtils');
const rank = await getUserRank(userId);
const stats = await getUserXpStats(userId);

// Use rank.emoji, rank.tierName, rank.level, etc.
```

---

### ✅ `modules/admin/actions/users/grantXP.js` (or similar)

**Simplify admin XP grants:**
```javascript
// OLD:
await applyDirectXp(userId, amount, 'admin_grant', { reason });

// NEW:
const { grantXp } = require('../../loyalty/rpgUtils');
await grantXp(userId, amount, 'admin_grant', { 
  reason,
  grantedBy: ctx.from.id
});
```

---

## Testing Strategy

### 1. **Parallel Testing** (Recommended)
Run both systems in parallel for a week:
- Keep old `xpService.js` as fallback
- Add new `rpgUtils.js` calls alongside
- Compare results
- Switch over once confident

### 2. **Feature Flag**
```javascript
// In configs/rpg.js
const USE_NEW_SYSTEM = process.env.USE_NEW_RPG_SYSTEM === 'true';

// In payment service
if (USE_NEW_SYSTEM) {
  await grantXpFromSubscription(...);
} else {
  await applyXpGain(...);
}
```

### 3. **Data Validation Script**
```javascript
// scripts/validate_xp_migration.js
const knex = require('./modules/db/knex');
const { calculateRankFromXp } = require('./configs/rpg');

async function validateAllUsers() {
  const users = await knex('user_levels').select('*');
  let driftCount = 0;

  for (const user of users) {
    const calculated = calculateRankFromXp(user.total_xp);
    if (calculated.tier !== user.current_tier || calculated.level !== user.current_level) {
      console.log(`Drift: User ${user.user_id}: ${user.current_tier} ${user.current_level} → ${calculated.tier} ${calculated.level}`);
      driftCount++;
    }
  }

  console.log(`Total drift detected: ${driftCount}/${users.length} users`);
}

validateAllUsers();
```

---

## Rollback Plan

If issues occur:

1. **Keep old code**: Don't delete `xpService.js` immediately
2. **Database is safe**: New system uses same tables (`user_levels`, `xp_transactions`)
3. **Config rollback**: Just revert `configs/rpg.js` to old version
4. **No data loss**: All XP transactions are logged

---

## Benefits Summary

| Feature | Old System | New System |
|---------|-----------|------------|
| **Config Management** | Hardcoded | Centralized in `configs/rpg.js` |
| **Rank Calculation** | On XP change only | Hybrid (validate on read) |
| **Star → XP** | Manual calculation | `grantXpFromStars()` |
| **Subscription XP** | Units formula | Direct from config |
| **Rank Checking** | Manual DB query | `hasRank()` one-liner |
| **Drift Detection** | None | Automatic with logging |
| **Leaderboard** | Manual joins | `getLeaderboard()` |
| **Notifications** | Repeated code | `sendRpgNotification()` |
| **Message XP** | Not implemented | Built-in with limits |
| **Extensibility** | Hard to add sources | Easy via config |

---

## Next Steps

1. ✅ Review `RPG_OVERHAUL.md` for full context
2. ✅ Update `configs/rpg.js` with your preferred values
3. ⏭️ Test new utilities with existing data
4. ⏭️ Migrate one module at a time (start with admin commands)
5. ⏭️ Monitor logs for drift detection
6. ⏭️ Once stable, deprecate old `xpService.js`

