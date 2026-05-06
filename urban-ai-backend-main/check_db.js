const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });
  const [rows] = await connection.execute("SELECT id, nome, source, createdAt FROM events ORDER BY createdAt DESC LIMIT 5");
  console.log("Latest Events:", rows);
  
  const [sourceRows] = await connection.execute("SELECT source, COUNT(*) as count FROM events GROUP BY source");
  console.log("Events by source:", sourceRows);
  
  await connection.end();
}
check().catch(console.error);
