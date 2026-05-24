// ============================================================
// INIȚIALIZAREA BAZEI DE DATE
// ============================================================
// Acest script creează fișierul SQLite (database.db) și
// rulează schema.sql + seed.sql dacă baza nu există deja.
// Se rulează automat la pornirea serverului (din db.js).
// ============================================================

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Calea absolută către fișierul bazei de date
const DB_PATH = path.join(__dirname, 'database.db');

// Verificăm dacă baza există deja - dacă da, nu o re-inițializăm
const isFreshDatabase = !fs.existsSync(DB_PATH);

// Deschidem (sau creăm) conexiunea
const db = new Database(DB_PATH);

// Activăm verificarea cheilor străine (mereu, la fiecare conexiune)
db.pragma('foreign_keys = ON');

if (isFreshDatabase) {
  console.log('Baza de date nu există - o creez acum...');

  // Citim și rulăm scriptul de schemă
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schemaSql);
  console.log('  ✓ Schema creată');

  // Citim și rulăm scriptul de seed
  const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
  db.exec(seedSql);
  console.log('  ✓ Date de demonstrație inserate');

  console.log('Bază de date pregătită!');
}

// Exportăm conexiunea pentru a fi folosită în restul aplicației
module.exports = db;
