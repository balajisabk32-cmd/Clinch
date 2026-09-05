require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function seed() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // Connect to default postgres DB first to create dealflow360
    database: 'postgres',
  });

  await client.connect();

  // Create database if not exists
  const dbCheck = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = 'dealflow360'`
  );
  if (dbCheck.rowCount === 0) {
    await client.query('CREATE DATABASE dealflow360');
    console.log('✅ Database dealflow360 created');
  } else {
    console.log('ℹ️  Database dealflow360 already exists');
  }
  await client.end();

  // Now connect to dealflow360 and run schema
  const dbClient = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'dealflow360',
  });

  await dbClient.connect();

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await dbClient.query(sql);
  console.log('✅ Schema created and seed data inserted');

  await dbClient.end();
  console.log('🎉 Database setup complete! You can now start the server.');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
