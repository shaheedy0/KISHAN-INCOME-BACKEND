const mysql = require('mysql2/promise');
require('dotenv').config();

// This creates a secure pipeline to your online TiDB database
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 4000,
    ssl: {
        rejectUnauthorized: true // This is the security lock TiDB requires
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;