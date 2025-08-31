/**
 * Seed: Initial roles setup
 * This seed file sets up basic roles for the RBAC system
 */

exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('userRoles').del()
    .then(function () {
      // Inserts seed entries
      return knex('userRoles').insert([
        // Add basic 'user' role to all existing users
        // You can customize this based on your existing user data
        // Example: { userId: 123456789, role: 'user' }
      ]);
    });
};
