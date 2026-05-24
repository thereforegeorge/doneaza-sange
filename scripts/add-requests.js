// ============================================================
// SCRIPT ONE-OFF: adaugă cereri suplimentare în DB-ul existent
// ------------------------------------------------------------
// Folosit când vrei mai multe cereri în feed dar nu vrei să
// ștergi DB-ul (păstrezi conturile și prieteniile existente).
//
// Rulare:  node scripts/add-requests.js
//
// Idempotent: dacă o cerere identică (spital + grupă + deadline)
// există deja, NU o duplică.
// ============================================================

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'db', 'database.db');
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// Aceleași cereri suplimentare ca în seed.sql (cele 7 noi peste cele 3 originale)
const newRequests = [
  { hospital_id: 1, blood_type: 'B+',  units_needed: 3, urgency: 'urgent',  deadline: '2026-06-03 14:00', notes: 'Accident rutier - intervenție în noaptea aceasta.' },
  { hospital_id: 2, blood_type: 'O+',  units_needed: 5, urgency: 'planned', deadline: '2026-06-08 10:00', notes: 'Transplant programat. Avem nevoie de mai multe unități.' },
  { hospital_id: 3, blood_type: 'A-',  units_needed: 2, urgency: 'urgent',  deadline: '2026-06-02 20:00', notes: 'Pacient anemic, intervenție chirurgicală mâine dimineață.' },
  { hospital_id: 1, blood_type: 'B-',  units_needed: 1, urgency: 'urgent',  deadline: '2026-06-04 11:00', notes: 'Caz pediatric. Grupă rară necesară urgent.' },
  { hospital_id: 2, blood_type: 'AB-', units_needed: 1, urgency: 'urgent',  deadline: '2026-06-03 08:00', notes: 'Cea mai rară grupă. Apelăm la toți donatorii disponibili.' },
  { hospital_id: 3, blood_type: 'O+',  units_needed: 3, urgency: 'planned', deadline: '2026-06-10 15:00', notes: 'Operație cardiacă programată.' },
  { hospital_id: 1, blood_type: 'A+',  units_needed: 2, urgency: 'planned', deadline: '2026-06-12 09:00', notes: 'Stoc preventiv pentru weekend.' }
];

// Verificăm pentru fiecare dacă există deja una identică (spital + grupă + deadline)
const findExisting = db.prepare(`
  SELECT id FROM requests
  WHERE hospital_id = ? AND blood_type = ? AND deadline = ?
`);

const insertRequest = db.prepare(`
  INSERT INTO requests (hospital_id, blood_type, units_needed, urgency, deadline, notes, status)
  VALUES (?, ?, ?, ?, ?, ?, 'open')
`);

let added = 0;
let skipped = 0;

for (const r of newRequests) {
  const existing = findExisting.get(r.hospital_id, r.blood_type, r.deadline);
  if (existing) {
    skipped++;
    continue;
  }
  insertRequest.run(r.hospital_id, r.blood_type, r.units_needed, r.urgency, r.deadline, r.notes);
  added++;
}

console.log('Cereri adăugate: ' + added);
console.log('Cereri sărite (existau deja): ' + skipped);

const total = db.prepare('SELECT COUNT(*) AS n FROM requests').get().n;
console.log('Total cereri în DB acum: ' + total);
