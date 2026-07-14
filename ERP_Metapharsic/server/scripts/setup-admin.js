#!/usr/bin/env node
/**
 * Backend Setup Script - Create Default Admin User
 * Usage: node setup-admin.js
 * 
 * This script:
 * 1. Connects to PostgreSQL
 * 2. Creates base tables if needed
 * 3. Creates default admin user with password hash
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'metapharsic_erp',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 10;

async function setupAdmin() {
  console.log('🔧 Setting up backend...\n');
  
  try {
    // Test connection
    console.log('📡 Connecting to database...');
    const testRes = await pool.query('SELECT NOW()');
    console.log('✅ Connected to database\n');

    // Check if users table exists
    console.log('📋 Checking users table...');
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      )`
    );

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Users table does not exist');
      console.log('   Run database migration first:');
      console.log('   psql -U postgres -d metapharsic_erp < server/migrations/001-initial-schema.sql');
      console.log('   psql -U postgres -d metapharsic_erp < server/migrations/002-add-security-columns.sql');
      process.exit(1);
    }
    console.log('✅ Users table exists\n');

    // Check if admin user already exists
    console.log('🔍 Checking for existing admin user...');
    const adminCheck = await pool.query(
      'SELECT id, username FROM users WHERE username = $1',
      ['admin']
    );

    if (adminCheck.rows.length > 0) {
      console.log(`✅ Admin user already exists (ID: ${adminCheck.rows[0].id})\n`);
      
      // Ask if want to reset password
      console.log('💡 To reset admin password, run:');
      console.log('   npm run reset-password\n');
      
      pool.end();
      return;
    }

    // Create admin user with hashed password
    console.log('🔐 Creating admin user with password hashing...');
    console.log(`   Using bcrypt rounds: ${BCRYPT_ROUNDS}\n`);

    const adminPassword = 'admin'; // Default password
    const hashedPassword = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

    const insertRes = await pool.query(
      `INSERT INTO users (
        username, email, password_hash, name, role, 
        created_at, two_factor_enabled
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      RETURNING id, username, email, role`,
      [
        'admin',
        'admin@metapharsic.local',
        hashedPassword,
        'Administrator',
        'ADMIN',
        false
      ]
    );

    const newAdmin = insertRes.rows[0];
    console.log('✅ Admin user created successfully!\n');
    console.log('User Details:');
    console.log(`  ID:       ${newAdmin.id}`);
    console.log(`  Username: ${newAdmin.username}`);
    console.log(`  Email:    ${newAdmin.email}`);
    console.log(`  Role:     ${newAdmin.role}\n`);

    // Test login
    console.log('🧪 Testing password verification...');
    const testMatch = await bcrypt.compare(adminPassword, hashedPassword);
    if (testMatch) {
      console.log('✅ Password verification works!\n');
    } else {
      console.log('❌ Password verification failed!\n');
    }

    // Create sample users for testing
    console.log('👥 Creating sample test users...');

    const sampleUsers = [
      { username: 'pharmacist', email: 'pharmacist@metapharsic.local', name: 'Test Pharmacist', role: 'PHARMACIST' },
      { username: 'cashier', email: 'cashier@metapharsic.local', name: 'Test Cashier', role: 'CASHIER' },
      { username: 'manager', email: 'manager@metapharsic.local', name: 'Test Manager', role: 'MANAGER' },
    ];

    for (const user of sampleUsers) {
      // Check if user already exists
      const exists = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [user.username]
      );

      if (exists.rows.length === 0) {
        const hashed = await bcrypt.hash('user', BCRYPT_ROUNDS);
        await pool.query(
          `INSERT INTO users (
            username, email, password_hash, name, role, 
            created_at, two_factor_enabled
          ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
          [user.username, user.email, hashed, user.name, user.role, false]
        );
        console.log(`  ✅ Created: ${user.username} (password: "user")`);
      } else {
        console.log(`  ℹ️  Skipped: ${user.username} (already exists)`);
      }
    }

    console.log('\n✨ Setup Complete!\n');
    console.log('🚀 Now you can login at http://localhost:5173/login');
    console.log('   Username: admin');
    console.log('   Password: admin\n');
    console.log('📝 Other test accounts:');
    console.log('   pharmacist / user');
    console.log('   cashier / user');
    console.log('   manager / user\n');

    console.log('Next steps:');
    console.log('1. Start backend: npm start (from server directory)');
    console.log('2. Start frontend: npm run dev (from root)');
    console.log('3. Login at http://localhost:5173\n');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure PostgreSQL is running');
    console.error('2. Check database credentials in .env');
    console.error('3. Verify DB_NAME matches your database');
    console.error('4. Run migrations: psql -U postgres -d DATABASE < migration.sql\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupAdmin();
