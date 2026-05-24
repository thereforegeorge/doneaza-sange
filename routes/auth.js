// Rute pentru autentificare: signup donator, login, logout, profilul curent.
// Spitalele nu se înregistrează singure - conturile lor sunt create
// la inițializarea bazei (seed.sql), pentru a evita conturi false.

const express = require('express');
const db = require('../db.js');
const { generateToken, requireLogin } = require('../auth.js');

const router = express.Router();

// ------------------------------------------------------------
// POST /api/auth/signup - înregistrare donator nou
// ------------------------------------------------------------
// Corpul cererii trebuie să conțină: email, password, name, blood_type
// Opțional: last_donation, city, lat, lng (geolocație din browser)
router.post('/signup', (req, res) => {
  const { email, password, name, blood_type, last_donation, city, lat, lng } = req.body;

  // Validări de bază - câmpuri obligatorii + parolă minim 4 caractere
  if (!email || !password || !name || !blood_type) {
    return res.status(400).json({ error: 'Lipsesc date obligatorii' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Parola trebuie să aibă minim 4 caractere' });
  }

  // Verificăm că email-ul nu e deja folosit
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email-ul e deja folosit' });
  }

  // Generăm un token de sesiune pentru utilizator
  const token = generateToken();

  // Inserăm utilizatorul nou cu rolul "donor"
  const result = db.prepare(`
    INSERT INTO users (email, password, token, name, role, blood_type, last_donation, city, lat, lng)
    VALUES (?, ?, ?, ?, 'donor', ?, ?, ?, ?, ?)
  `).run(email, password, token, name, blood_type, last_donation || null, city || null, lat || null, lng || null);

  // Întoarcem token-ul, frontend-ul îl salvează în localStorage
  res.json({
    token,
    user: {
      id: result.lastInsertRowid,
      email,
      name,
      role: 'donor',
      blood_type
    }
  });
});

// ------------------------------------------------------------
// POST /api/auth/login - autentificare cu email + parolă
// ------------------------------------------------------------
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email și parolă obligatorii' });
  }

  // Căutăm utilizatorul după email
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || user.password !== password) {
    // Mesaj generic ca să nu dezvăluim dacă email-ul există în sistem
    return res.status(401).json({ error: 'Email sau parolă greșite' });
  }

  // Generăm un token nou (delogăm sesiunile vechi automat)
  const token = generateToken();
  db.prepare('UPDATE users SET token = ? WHERE id = ?').run(token, user.id);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      blood_type: user.blood_type,
      hospital_id: user.hospital_id
    }
  });
});

// ------------------------------------------------------------
// POST /api/auth/logout - ștergerea token-ului curent
// ------------------------------------------------------------
router.post('/logout', requireLogin, (req, res) => {
  db.prepare('UPDATE users SET token = NULL WHERE id = ?').run(req.user.id);
  res.json({ ok: true });
});

// ------------------------------------------------------------
// GET /api/auth/me - returnează utilizatorul autentificat
// ------------------------------------------------------------
// Frontend-ul îl apelează la încărcarea paginii ca să afle dacă
// token-ul din localStorage e încă valid și cine e utilizatorul.
router.get('/me', requireLogin, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
    blood_type: req.user.blood_type,
    last_donation: req.user.last_donation,
    hospital_id: req.user.hospital_id
  });
});

module.exports = router;
