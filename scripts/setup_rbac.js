#!/usr/bin/env node

/**
 * Setup script for RBAC system
 * This script helps set up the database tables and initial roles
 */

const knex = require('../modules/db/knex');

async function setupRBAC() {
  try {
    console.log('🔐 Setting up RBAC system...\n');
    
    // Check if userRoles table exists
    const tableExists = await knex.schema.hasTable('userRoles');
    
    if (tableExists) {
      console.log('✅ userRoles table already exists');
    } else {
      console.log('📋 Creating userRoles table...');
      
      // Create the table using the migration
      await knex.schema.createTable('userRoles', function(table) {
        table.increments('id').primary();
        table.bigInteger('userId').notNullable();
        table.string('role', 50).notNullable();
        table.timestamp('createdAt').defaultTo(knex.fn.now());
        table.timestamp('updatedAt').defaultTo(knex.fn.now());
        
        // Indexes
        table.index(['userId']);
        table.index(['role']);
        table.unique(['userId', 'role']);
      });
      
      console.log('✅ userRoles table created successfully');
    }
    
    // Check if we have any users to assign basic roles to
    const users = await knex('users').select('id').limit(5);
    
    if (users.length > 0) {
      console.log(`\n👥 Found ${users.length} users in the system`);
      console.log('📝 You can now run the seed files to assign roles:');
      console.log('   npm run seed:roles');
      console.log('   npm run seed:admins');
    } else {
      console.log('\n⚠️  No users found in the system');
      console.log('   Create some users first, then run the seed files');
    }
    
    console.log('\n🎯 Next steps:');
    console.log('1. Update the seed files with actual user IDs');
    console.log('2. Run: npm run seed:roles');
    console.log('3. Run: npm run seed:admins');
    console.log('4. Test the RBAC system with: node test_rbac.js');
    
  } catch (error) {
    console.error('❌ Error setting up RBAC:', error);
  } finally {
    await knex.destroy();
  }
}

// Run the setup
setupRBAC();
