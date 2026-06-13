# RPG (XP) System Overhaul

## 1. Current Database Structure

### Tables Overview

#### `user_levels` (Current XP System)
```sql
- user_id (bigint, primary key)
- current_tier (string) - wood/bronze/silver/gold/platinum/diamond/mithril/legend
- current_level (integer) - 1-10 (legend 1+)
- total_xp (integer) - Accumulated experience points
- total_spending_units (decimal) - S in units formula
- xp_to_next_level (integer) - Calculated remaining XP
- level_up_date (timestamp)
- created_at (timestamp)
- updated_at (timestamp)
```

#### `xp_transactions` (Transaction Log)
```sql
- id (increments)
- user_id (bigint)
- amount (integer) - XP delta (+/-)
- source (string) - 'spending_payment', 'raid_complete', 'admin_grant', etc.
- description (text)
- metadata (jsonb)
- created_at (timestamp)
```

#### `userLoyalty` (Legacy System - Should be deprecated)
```sql
- id (increments)
- userId (bigint)
- level (string) - Simple tier name
- createdAt (timestamp)
- updatedAt (timestamp)
```

### Current XP Calculation

**Formula**: `XP = 173.8 × (units^0.393)`

**Base Units**:
- Regular subscription: 600 units
- Plus subscription: 1600 units
- Kickstarter backing: 300 units per backing cap

**Current Issues**:
1. Two loyalty systems exist (userLoyalty + user_levels)
2. XP formula is complex and not configurable
3. Tier thresholds are hardcoded in xpService.js
4. Star-to-XP conversion is indirect (stars → units → XP)
5. No configurable XP sources beyond payments

---

## 2. Rank Calculation Approaches

### **Option 1: Pure Calculation (No Storage)** ⚡
**How it works**: Calculate rank on-the-fly from `total_xp` every time it's needed.

**Pros**:
- ✅ Always accurate (no sync issues)
- ✅ Simpler database schema
- ✅ Easy to change tier thresholds
- ✅ No migration needed for tier changes

**Cons**:
- ❌ Repeated calculations (performance impact)
- ❌ Complex queries for leaderboards
- ❌ No historical data on when level-ups occurred
- ❌ Can't easily query "all users at tier X"

**Best for**: Small user bases (<1000 users)

---

### **Option 2: Hybrid Approach (Store + Validate)** ⭐ **RECOMMENDED**
**How it works**: Store calculated rank, but recalculate on read if XP has changed.

**Implementation**:
```javascript
async function getUserRank(userId) {
  const user = await getUser(userId);
  const calculatedRank = calculateRankFromXp(user.total_xp);
  
  // If stored rank differs from calculated, update it
  if (user.current_tier !== calculatedRank.tier || 
      user.current_level !== calculatedRank.level) {
    await updateUserRank(userId, calculatedRank);
    return calculatedRank;
  }
  
  return { tier: user.current_tier, level: user.current_level };
}
```

**Pros**:
- ✅ Best performance (read from DB usually)
- ✅ Self-healing (auto-corrects drift)
- ✅ Good for leaderboards (can query stored values)
- ✅ Tracks level-up dates
- ✅ Easy to audit inconsistencies

**Cons**:
- ⚠️ Slightly more complex logic
- ⚠️ Requires background job for tier threshold changes

**Best for**: Most production systems (scales well)

---

### **Option 3: Pure Storage (Trust the DB)** 🔒
**How it works**: Always update rank when XP changes; never recalculate.

**Implementation**:
```javascript
async function grantXp(userId, amount) {
  const user = await getUser(userId);
  const newXp = user.total_xp + amount;
  const newRank = calculateRankFromXp(newXp);
  
  await updateUser(userId, {
    total_xp: newXp,
    current_tier: newRank.tier,
    current_level: newRank.level
  });
}
```

**Pros**:
- ✅ Excellent read performance
- ✅ Simple queries
- ✅ Good for leaderboards
- ✅ Tracks level-up history

**Cons**:
- ❌ Can drift if XP is modified directly
- ❌ Requires migration when tier thresholds change
- ❌ No self-healing
- ❌ Must ensure all XP changes trigger rank update

**Best for**: High-traffic systems with strict XP change controls

---

## 3. Recommendation: Hybrid Approach

**Why Hybrid?**
1. **Performance**: Fast reads (from DB) for most cases
2. **Accuracy**: Self-healing on every read
3. **Flexibility**: Can change tier thresholds without migration
4. **Auditability**: Can detect and log drift
5. **Scale**: Works for 100 to 100,000+ users

**Implementation Strategy**:
- Store tier/level in DB for fast queries
- Validate on read and update if needed
- Log when drift is detected
- Background job to fix bulk drift (optional)

---

## 4. Proposed Configuration Structure

See `configs/rpg.js` for the new comprehensive configuration.

**Key Features**:
1. **Tier Definitions**: Clear threshold-based levels
2. **XP Sources**: Configurable XP gain for different actions
3. **Coefficients**: Star-to-XP, message-to-XP conversions
4. **Limits**: Daily/weekly caps for activities
5. **Display Data**: Emojis, names, descriptions for each tier

---

## 5. Migration Path

### Phase 1: New Config (Non-Breaking)
- ✅ Create new `configs/rpg.js` with comprehensive structure
- ✅ Keep old config as fallback

### Phase 2: New Utilities (Non-Breaking)
- ✅ Implement new utility functions
- ✅ Use hybrid calculation approach
- ✅ Keep old functions working

### Phase 3: Update Services (Breaking)
- ⚠️ Update `xpService.js` to use new config
- ⚠️ Update payment services to use new utilities
- ⚠️ Test thoroughly

### Phase 4: Deprecate Old System
- 🗑️ Remove `userLoyalty` table (after confirming migration)
- 🗑️ Remove old loyalty/index.js functions
- 🗑️ Clean up unused code

---

## 6. Next Steps

1. ✅ Review this document
2. ⏭️ Implement new `configs/rpg.js`
3. ⏭️ Create utility functions in `modules/loyalty/rpgUtils.js`
4. ⏭️ Update `xpService.js` to use new system
5. ⏭️ Test with existing data
6. ⏭️ Deploy and monitor

