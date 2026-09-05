require('dotenv').config();

// If DB_TYPE is explicitly postgres, use pg Pool
if (process.env.DB_TYPE === 'postgres') {
  const { Pool } = require('pg');
  const pgPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  pgPool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL');
  });

  pgPool.on('error', (err) => {
    console.error('❌ PostgreSQL connection error:', err.message);
  });

  module.exports = pgPool;
} else {
  // Default: zero-configuration, lightning-fast embedded SQLite database
  console.log('🚀 Using zero-config embedded SQLite database (server/db/dealflow360.sqlite)');
  const sqlitePool = require('./sqlite-db');
  module.exports = sqlitePool;
}
