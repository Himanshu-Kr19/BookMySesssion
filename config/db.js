// config/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
    ssl: { rejectUnauthorized: false }
});

pool.connect((err) => {
    if (err) {
        console.error('Error connecting to PostgreSQL', err);
    } else {
        console.log('Connected to PostgreSQL (Supabase)');
    }
});
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error running test query', err);
    } else {
        console.log('Test query result:', res.rows);
    }
});


module.exports = pool;