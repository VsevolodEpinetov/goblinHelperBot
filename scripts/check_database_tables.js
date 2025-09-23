#!/usr/bin/env node

/**
 * Check what tables exist in the database
 */

const knex = require('../modules/db/knex');

async function checkDatabaseTables() {
  try {
    console.log('🔍 Checking database tables...\n');
    
    // Get all tables
    const tables = await knex.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 Available tables:');
    tables.rows.forEach(table => {
      console.log(`  • ${table.table_name}`);
    });
    
    // Check if userRoles table exists
    const userRolesExists = await knex.schema.hasTable('userRoles');
    console.log(`\n🔐 userRoles table exists: ${userRolesExists}`);
    
    // Check if userGroups table exists
    const userGroupsExists = await knex.schema.hasTable('userGroups');
    console.log(`📊 userGroups table exists: ${userGroupsExists}`);
    
    // Check if users table exists
    const usersExists = await knex.schema.hasTable('users');
    console.log(`👥 users table exists: ${usersExists}`);
    
    if (usersExists) {
      const userCount = await knex('users').count('* as count').first();
      console.log(`👥 Total users: ${userCount.count}`);
    }
    
    if (userGroupsExists) {
      const groupCount = await knex('userGroups').count('* as count').first();
      console.log(`📊 Total group memberships: ${groupCount.count}`);
    }
    
    if (userRolesExists) {
      const roleCount = await knex('userRoles').count('* as count').first();
      console.log(`🔐 Total role assignments: ${roleCount.count}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await knex.destroy();
  }
}

checkDatabaseTables();
