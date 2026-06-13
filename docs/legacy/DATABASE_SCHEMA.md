# RPG System - Database Schema

## Current Tables

### 1. `user_levels` (Primary XP Table)

```
┌─────────────────────┬──────────────┬──────────────┬──────────────────────────┐
│ Column              │ Type         │ Default      │ Description              │
├─────────────────────┼──────────────┼──────────────┼──────────────────────────┤
│ user_id             │ bigint       │ -            │ PRIMARY KEY (Telegram)   │
│ current_tier        │ varchar(20)  │ 'wood'       │ wood/bronze/silver/...   │
│ current_level       │ integer      │ 1            │ 1-10 (legend 1+)         │
│ total_xp            │ integer      │ 0            │ Accumulated XP           │
│ total_spending_units│ decimal(14,2)│ 0            │ Legacy (for old formula) │
│ xp_to_next_level    │ integer      │ NULL         │ Calculated XP needed     │
│ level_up_date       │ timestamp    │ NULL         │ Last level-up            │
│ created_at          │ timestamp    │ now()        │ Row creation             │
│ updated_at          │ timestamp    │ now()        │ Last update              │
└─────────────────────┴──────────────┴──────────────┴──────────────────────────┘

INDEX: (current_tier, current_level) - for leaderboard queries
```

**Key Points:**
- ✅ Stores both XP (`total_xp`) and calculated rank (`current_tier`, `current_level`)
- ✅ Hybrid approach: rank is stored but validated on read
- ✅ `total_spending_units` kept for backward compatibility with old formula
- ✅ `xp_to_next_level` helps UI show progress bars

---

### 2. `xp_transactions` (Transaction Log)

```
┌─────────────┬──────────┬──────────┬─────────────────────────────────────┐
│ Column      │ Type     │ Default  │ Description                         │
├─────────────┼──────────┼──────────┼─────────────────────────────────────┤
│ id          │ serial   │ auto     │ PRIMARY KEY                         │
│ user_id     │ bigint   │ -        │ Who gained/lost XP                  │
│ amount      │ integer  │ -        │ XP delta (+/-)                      │
│ source      │ varchar  │ -        │ 'spending_payment', 'raid', etc.    │
│ description │ text     │ NULL     │ Human-readable description          │
│ metadata    │ jsonb    │ NULL     │ Extra data (period, stars, etc.)    │
│ created_at  │ timestamp│ now()    │ When XP was granted                 │
└─────────────┴──────────┴──────────┴─────────────────────────────────────┘

INDEX: (user_id, created_at) - for user history queries
```

**Key Points:**
- ✅ Complete audit trail of all XP changes
- ✅ `amount` can be negative (XP removal/correction)
- ✅ `metadata` stores context (payment info, raid ID, etc.)
- ✅ Never delete - historical record

**Example Rows:**
```sql
| id  | user_id | amount | source             | metadata                                    | created_at          |
|-----|---------|--------|--------------------|---------------------------------------------|---------------------|
| 1   | 123456  | +1600  | spending_payment   | {"subscriptionType":"plus","period":"2025_10"} | 2025-10-03 10:23:45 |
| 2   | 123456  | +100   | raid_complete      | {"raidId":42,"raidTitle":"Boss Raid"}      | 2025-10-03 15:30:12 |
| 3   | 789012  | +500   | admin_grant        | {"reason":"Testing help","grantedBy":111}  | 2025-10-03 16:45:00 |
| 4   | 123456  | -50    | admin_grant        | {"reason":"XP correction","grantedBy":111} | 2025-10-03 17:00:00 |
```

---

### 3. `user_achievements` (Achievement System)

```
┌──────────────────┬──────────┬──────────┬──────────────────────────────┐
│ Column           │ Type     │ Default  │ Description                  │
├──────────────────┼──────────┼──────────┼──────────────────────────────┤
│ id               │ serial   │ auto     │ PRIMARY KEY                  │
│ user_id          │ bigint   │ -        │ Who earned achievement       │
│ achievement_type │ varchar  │ -        │ e.g., 'years_of_service'     │
│ achievement_data │ jsonb    │ NULL     │ Achievement-specific data    │
│ unlocked_at      │ timestamp│ now()    │ When earned                  │
│ is_public        │ boolean  │ true     │ Show on profile?             │
└──────────────────┴──────────┴──────────┴──────────────────────────────┘

INDEX: (user_id, achievement_type) - unique achievements per user
```

**Key Points:**
- ✅ Separate from XP system (achievements can grant XP bonuses)
- ✅ Used for discounts (e.g., "years of service" achievement)
- ✅ Can be displayed on profile

---

### 4. `level_management_log` (Admin Actions)

```
┌─────────────────┬──────────┬──────────┬───────────────────────────────┐
│ Column          │ Type     │ Default  │ Description                   │
├─────────────────┼──────────┼──────────┼───────────────────────────────┤
│ id              │ serial   │ auto     │ PRIMARY KEY                   │
│ admin_user_id   │ bigint   │ -        │ Who performed action          │
│ target_user_id  │ bigint   │ -        │ Who was affected              │
│ action_type     │ varchar  │ -        │ 'grant_xp', 'set_level', etc. │
│ old_tier        │ varchar  │ NULL     │ Before tier                   │
│ old_level       │ integer  │ NULL     │ Before level                  │
│ old_xp          │ integer  │ NULL     │ Before XP                     │
│ new_tier        │ varchar  │ NULL     │ After tier                    │
│ new_level       │ integer  │ NULL     │ After level                   │
│ new_xp          │ integer  │ NULL     │ After XP                      │
│ reason          │ text     │ NULL     │ Why action was taken          │
│ metadata        │ jsonb    │ NULL     │ Extra context                 │
│ created_at      │ timestamp│ now()    │ When action occurred          │
└─────────────────┴──────────┴──────────┴───────────────────────────────┘

INDEX: (target_user_id, created_at) - for user's admin history
```

**Key Points:**
- ✅ Audit log for admin actions
- ✅ Shows before/after state
- ✅ Helps track abuse or mistakes

---

### 5. `userLoyalty` (Legacy - To Be Deprecated)

```
┌───────────┬──────────┬──────────┬─────────────────────────┐
│ Column    │ Type     │ Default  │ Description             │
├───────────┼──────────┼──────────┼─────────────────────────┤
│ id        │ serial   │ auto     │ PRIMARY KEY             │
│ userId    │ bigint   │ -        │ User ID                 │
│ level     │ varchar  │ 'bronze_3'│ Old tier format        │
│ createdAt │ timestamp│ now()    │ Created                 │
│ updatedAt │ timestamp│ now()    │ Updated                 │
└───────────┴──────────┴──────────┴─────────────────────────┘

⚠️ DEPRECATED: Use user_levels instead
```

**Migration Plan:**
- Keep for now (backward compatibility)
- Once confident, drop table
- Data already migrated to `user_levels`

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        XP GRANTING FLOW                             │
└─────────────────────────────────────────────────────────────────────┘

    User Action
        │
        ├─► Payment (Stars) ──► grantXpFromSubscription()
        ├─► Raid Complete ────► grantXp(userId, 100, 'raid_complete')
        ├─► Admin Grant ──────► grantXp(userId, amount, 'admin_grant')
        └─► Message (future) ─► grantXpFromMessage()
                │
                ▼
        ┌───────────────────┐
        │  rpgUtils.grantXp │
        │                   │
        │  1. Get user row  │
        │  2. Calculate XP  │
        │  3. Calculate rank│
        │  4. Update DB     │
        │  5. Log to txns   │
        │  6. Send notif    │
        └───────────────────┘
                │
                ├─► UPDATE user_levels
                │   └─ total_xp = old_xp + delta
                │   └─ current_tier = calculated_tier
                │   └─ current_level = calculated_level
                │
                ├─► INSERT xp_transactions
                │   └─ user_id, amount, source, metadata
                │
                └─► SEND NOTIFICATION (if enabled)
                    ├─ XP gain notification (if >= threshold)
                    └─ Level up notification (if leveled up)
```

---

## Rank Calculation Flow (Hybrid Approach)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     RANK RETRIEVAL FLOW                             │
└─────────────────────────────────────────────────────────────────────┘

    getUserRank(userId)
        │
        ▼
    ┌──────────────────────┐
    │ SELECT * FROM        │
    │ user_levels          │
    │ WHERE user_id = ?    │
    └──────────────────────┘
        │
        ▼
    ┌──────────────────────────────────┐
    │ Calculate rank from total_xp     │
    │ using rpgConfig.calculateRankFromXp │
    └──────────────────────────────────┘
        │
        ├─► COMPARE stored rank vs calculated
        │
        ├─► IF MATCH:
        │   └─► Return stored rank (fast path)
        │
        └─► IF DRIFT:
            ├─► Log drift detection
            ├─► UPDATE user_levels with correct rank
            └─► Return calculated rank
```

**Why Hybrid?**
- ✅ Fast reads (usually just DB lookup)
- ✅ Self-healing (auto-fixes drift)
- ✅ Works even if tier thresholds change
- ✅ Scales well (100 to 100k+ users)

---

## Query Examples

### Get User's Current Rank
```sql
-- Application code (recommended):
getUserRank(userId)

-- Direct SQL (not recommended, bypasses validation):
SELECT user_id, current_tier, current_level, total_xp
FROM user_levels
WHERE user_id = 123456;
```

### Get Leaderboard
```sql
-- Application code:
getLeaderboard(10)

-- SQL equivalent:
SELECT ul.user_id, ul.total_xp, ul.current_tier, ul.current_level,
       u.username, u."firstName", u."lastName"
FROM user_levels ul
JOIN users u ON ul.user_id = u.id
ORDER BY ul.total_xp DESC
LIMIT 10;
```

### Get User's XP History
```sql
SELECT amount, source, description, metadata, created_at
FROM xp_transactions
WHERE user_id = 123456
ORDER BY created_at DESC
LIMIT 20;
```

### Find All Users in Tier
```sql
SELECT user_id, current_level, total_xp
FROM user_levels
WHERE current_tier = 'gold'
ORDER BY current_level DESC, total_xp DESC;
```

### Weekly XP Report
```sql
SELECT user_id, SUM(amount) as weekly_xp
FROM xp_transactions
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND amount > 0
GROUP BY user_id
ORDER BY weekly_xp DESC
LIMIT 10;
```

---

## Migration Path

### Phase 1: Current State ✅
- `user_levels` exists and is used
- `xp_transactions` logs all changes
- `userLoyalty` still exists (unused)

### Phase 2: Deploy New System ⏭️
1. Deploy `configs/rpg.js`
2. Deploy `modules/loyalty/rpgUtils.js`
3. Test with existing data
4. Validate no drift (or acceptable drift)

### Phase 3: Gradual Migration ⏭️
5. Update payment services → `grantXpFromSubscription()`
6. Update admin commands → `grantXp()`
7. Update raids → `grantXp(..., 'raid_complete')`
8. Update profile → `getUserRank()`

### Phase 4: Cleanup ⏭️
9. Deprecate old `xpService.js` functions
10. Drop `userLoyalty` table
11. Clean up unused code

---

## Backup & Rollback

### Before Migration
```bash
# Backup user_levels
pg_dump -U user -t user_levels dbname > user_levels_backup.sql

# Backup xp_transactions
pg_dump -U user -t xp_transactions dbname > xp_transactions_backup.sql
```

### Rollback (if needed)
```bash
# Restore tables
psql -U user dbname < user_levels_backup.sql
psql -U user dbname < xp_transactions_backup.sql

# Revert code to old xpService.js
git checkout HEAD~1 modules/loyalty/xpService.js
```

**Safe Migration:**
- ✅ No schema changes needed
- ✅ Tables stay the same
- ✅ Only logic changes
- ✅ Easy rollback

---

## Performance Considerations

### Indexes (Already Exist)
```sql
CREATE INDEX idx_user_levels_tier_level ON user_levels(current_tier, current_level);
CREATE INDEX idx_xp_transactions_user_date ON xp_transactions(user_id, created_at);
```

### Query Performance
- ✅ `getUserRank()`: Single SELECT by primary key (fast)
- ✅ `getLeaderboard()`: Uses index on (tier, level)
- ✅ `getUserXpStats()`: 2-3 queries (acceptable)

### Caching (Future Enhancement)
```javascript
// Optional: Add Redis cache for frequently accessed ranks
const cache = require('redis-client');

async function getUserRank(userId) {
  const cached = await cache.get(`rank:${userId}`);
  if (cached) return JSON.parse(cached);
  
  // ... fetch from DB ...
  
  await cache.set(`rank:${userId}`, JSON.stringify(rank), 'EX', 300); // 5min TTL
  return rank;
}
```

---

## Security Considerations

### SQL Injection
✅ All queries use Knex query builder (parameterized)

### XP Manipulation
✅ All XP changes logged to `xp_transactions`
✅ Admin actions logged to `level_management_log`

### Validation
✅ Hybrid approach auto-corrects tampering
✅ Drift detection logs suspicious changes

---

## Summary

✅ **4 main tables**: `user_levels`, `xp_transactions`, `user_achievements`, `level_management_log`
✅ **1 legacy table**: `userLoyalty` (to be deprecated)
✅ **Hybrid approach**: Stored + validated ranks
✅ **Complete audit trail**: Every XP change logged
✅ **No migration needed**: Tables already exist
✅ **Performance**: Optimized with indexes
✅ **Scalable**: Works for 100 to 100k+ users

