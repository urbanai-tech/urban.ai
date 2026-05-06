const mysql = require('mysql2/promise');
require('dotenv').config();

async function reset() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const [rows] = await connection.execute('SELECT * FROM `coverage_regions`');
  console.log('Regiões de cobertura:', rows);
  await connection.end();
}

reset().catch(console.error);
