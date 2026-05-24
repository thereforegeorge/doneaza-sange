// ============================================================
// CONEXIUNEA LA BAZA DE DATE
// ============================================================
// Re-exportă conexiunea creată de db/init.js. Folosim un singur
// fișier de bază de date (database.db) pentru toată aplicația.
// ============================================================

const db = require('./db/init.js');

module.exports = db;
