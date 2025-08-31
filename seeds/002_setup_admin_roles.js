/**
 * Seed: Setup admin roles
 * This seed file sets up admin roles for specific users
 * 
 * IMPORTANT: Update the userIds below with actual user IDs from your system
 */

exports.seed = function(knex) {
  return knex('userRoles').insert([
    // Example admin role assignments
    // Replace these userIds with actual user IDs from your system
    
    // Super admin (full access)
    // { userId: 91430770, role: 'super' },      // EPINETOV from settings.json
    // { userId: 91430770, role: 'user' },       // Also give basic user role
    
    // Regular admin
    // { userId: 628694430, role: 'admin' },     // ALEKS from settings.json
    // { userId: 628694430, role: 'user' },      // Also give basic user role
    
    // Admin Plus
    // { userId: 101922344, role: 'adminPlus' }, // ANN from settings.json
    // { userId: 101922344, role: 'user' },      // Also give basic user role
    
    // Polls admin
    // { userId: 176988041, role: 'polls' },     // YURI from settings.json
    // { userId: 176988041, role: 'user' },      // Also give basic user role
    
    // Goblin users (premium)
    // { userId: 1519577898, role: 'goblin' },   // MIMO from settings.json
    // { userId: 1519577898, role: 'user' },     // Also give basic user role
    
    // { userId: 1129968341, role: 'goblin' },   // ARTYOM from settings.json
    // { userId: 1129968341, role: 'user' },     // Also give basic user role
  ]);
};
