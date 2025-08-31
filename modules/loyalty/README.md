# Loyalty Level System

A simplified 30-level loyalty system based on valuable materials, without points tracking.

## 🏆 Level System Overview

### **10 Materials × 3 Sublevels = 30 Total Levels**

The system uses 10 different valuable materials, each with 3 sublevels (III → II → I):

1. **🥉 Bronze** - Starting material
2. **🟠 Copper** - Basic crafting
3. **⚫ Iron** - Sturdy foundation
4. **🔘 Steel** - Intermediate strength
5. **🥈 Silver** - Precious metal
6. **🥇 Gold** - Elite status
7. **💎 Platinum** - Premium tier
8. **💠 Diamond** - Legendary status
9. **⚔️ Adamantium** - Master level

### **Sublevel Progression**
- **III** (worst) → **II** (better) → **I** (best)
- Example: Bronze III → Bronze II → Bronze I → Copper III

## 💰 Benefits by Tier

### **Tier 1: Basic Materials (Bronze, Copper, Iron)**
- Basic access to STL files
- Can participate in polls
- Basic support
- 0-8% discount on purchases

### **Tier 2: Intermediate Materials (Steel, Silver)**
- All Tier 1 benefits
- Priority support
- Access to exclusive content
- Can submit content for review
- 9-14% discount on purchases

### **Tier 3: Precious Materials (Gold, Platinum)**
- All Tier 2 benefits
- Early access to new releases
- Can create polls
- Custom profile badge
- VIP support channel
- 15-20% discount on purchases

### **Tier 4: Legendary Materials (Diamond, Adamantium)**
- All Tier 3 benefits
- Beta tester access
- Can suggest new features
- Personal admin contact
- Annual meetup invitation
- Exclusive Discord role
- 22-35% discount on purchases

## 🗄️ Database Structure

### **Tables Created:**
1. `userLoyalty` - User current level

### **Key Features:**
- Simple level tracking
- Admin-assigned levels
- Level-based benefits

## 🤖 Bot Commands

### **User Commands:**
- `/profile` - View loyalty profile
- `/leaderboard` - See top users
- `/loyalty_help` - How the system works

### **Admin Commands:**
- `/set_level <userId> <level>` - Set user level manually
- `/list_levels` - Show all available levels

## 🔧 Technical Implementation

### **Key Functions:**
- `setUserLevel(userId, level)` - Set user level directly
- `getUserLoyalty(userId)` - Get user's loyalty data
- `getLevelInfo(level)` - Get level information
- `getLevelBenefits(level)` - Get benefits for level
- `getMaterialProgression(level)` - Get material progression info

### **Level Assignment:**
- Levels are assigned manually by administrators
- Based on community contribution and activity
- No automatic progression system

## 📊 Level Progression Example

```
User starts: Bronze III
Admin promotes to: Bronze II
Admin promotes to: Bronze I
Admin promotes to: Copper III
Admin promotes to: Steel I
```

## 🎮 Features

### **Progress Tracking:**
- Visual level display
- Material progression indicators
- Next level previews
- Tier-based benefits

### **Social Features:**
- Leaderboards
- Level comparisons
- Community recognition

### **Rewards:**
- Increasing discounts
- Exclusive content access
- Special permissions
- Recognition badges

## 🚀 Setup Instructions

1. **Run migrations:**
   ```bash
   npm run migrate
   ```

2. **Test the system:**
   ```bash
   node test_loyalty.js
   ```

## 📈 Benefits for Community

- **Clear Hierarchy:** Simple level system for user recognition
- **Admin Control:** Manual level assignment for quality control
- **Retention:** Level-based benefits keep users invested
- **Quality:** Higher-level users get more privileges
- **Flexibility:** Easy to adjust levels based on contribution

## 🔮 Future Enhancements

- Points system integration
- Automatic level progression
- Seasonal events
- Special achievements and badges
- Level-based content unlocking
- Community challenges
- Integration with Discord roles

## 🎯 Usage Examples

### **Setting User Level:**
```
/set_level 123456789 gold_2
```

### **Available Levels:**
- bronze_3, bronze_2, bronze_1
- copper_3, copper_2, copper_1
- iron_3, iron_2, iron_1
- steel_3, steel_2, steel_1
- silver_3, silver_2, silver_1
- gold_3, gold_2, gold_1
- platinum_3, platinum_2, platinum_1
- diamond_3, diamond_2, diamond_1
- adamantium_3, adamantium_2, adamantium_1
