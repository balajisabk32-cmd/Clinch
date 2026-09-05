const { default: EmbeddedPostgres } = require('embedded-postgres');
const path = require('path');

async function startDb() {
  const pg = new EmbeddedPostgres({
    port: 5432,
    databasePath: path.resolve(__dirname, '../data/db'),
    user: 'postgres',
    password: 'postgres',
    persistent: true,
  });

  console.log('Checking/Starting local PostgreSQL on port 5432...');
  try {
    await pg.start();
    console.log('✅ PostgreSQL is running on port 5432 (database: dealflow360)');
  } catch (err) {
    if (err.message && err.message.includes('already running')) {
      console.log('✅ PostgreSQL is already running on port 5432');
    } else {
      console.error('Error starting PostgreSQL:', err);
    }
  }
}

if (require.main === module) {
  startDb();
}

module.exports = startDb;
