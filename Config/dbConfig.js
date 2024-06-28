const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: './config.env' });

const pool = new Pool({
  user: process.env.SQL_DB_USER,
  host: process.env.SQL_DB_HOST,
  database: process.env.SQL_DB_NAME,
  password: process.env.SQL_DB_PASSWORD,
  port: process.env.SQL_DB_PORT,
});

module.exports = { pool };
