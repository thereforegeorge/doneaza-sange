// Sistemul de prietenii: trimitere cerere, accept, refuz, listare.
//   POST  /api/friends/request    : trimite cerere de prietenie (după email)
//   POST  /api/friends/accept/:id : acceptă o cerere primită
//   POST  /api/friends/decline/:id: refuză o cerere primită
//   GET   /api/friends            : listează prieteniile + cererile primite

const express = require('express');
const db = require('../db.js');
const { requireLogin } = require('../auth.js');

const router = express.Router();

// Helper: o pereche de prietenie e stocată cu user_a < user_b.
// Funcția returnează [mic, mare] indiferent de ordinea de intrare.
function orderedPair(idA, idB) {
  return idA < idB ? [idA, idB] : [idB, idA];
}

// ------------------------------------------------------------
// POST /api/friends/request - trimite cerere către un email
// ------------------------------------------------------------
router.post('/request', requireLogin, (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email lipsă' });

  // Căutăm destinatarul
  const target = db.prepare('SELECT id, name, role FROM users WHERE email = ?').get(email);
  if (!target) {
    return res.status(404).json({ error: 'Nu există un utilizator cu acest email' });
  }
  if (target.id === req.user.id) {
    return res.status(400).json({ error: 'Nu îți poți trimite cerere ție' });
  }
  if (target.role !== 'donor') {
    return res.status(400).json({ error: 'Poți adăuga doar donatori ca prieteni' });
  }

  // Verificăm dacă sunt deja prieteni
  const [a, b] = orderedPair(req.user.id, target.id);
  const existingFriend = db.prepare(
    'SELECT id FROM friendships WHERE user_a = ? AND user_b = ?'
  ).get(a, b);
  if (existingFriend) {
    return res.status(409).json({ error: 'Sunteți deja prieteni' });
  }

  // Verificăm dacă există deja cerere în sens invers - dacă da, o acceptăm direct
  const reverse = db.prepare(
    'SELECT id FROM friend_requests WHERE from_user = ? AND to_user = ?'
  ).get(target.id, req.user.id);
  if (reverse) {
    db.prepare('DELETE FROM friend_requests WHERE id = ?').run(reverse.id);
    db.prepare('INSERT INTO friendships (user_a, user_b) VALUES (?, ?)').run(a, b);
    return res.json({ ok: true, status: 'accepted_existing' });
  }

  // Inserăm cererea nouă (UNIQUE previne duplicate)
  try {
    db.prepare(
      'INSERT INTO friend_requests (from_user, to_user) VALUES (?, ?)'
    ).run(req.user.id, target.id);
  } catch (e) {
    return res.status(409).json({ error: 'Ai trimis deja cerere acestei persoane' });
  }

  // Notificăm destinatarul + emitem evenimentul Socket.io în camera lui
  db.prepare(`
    INSERT INTO notifications (user_id, type, message, link)
    VALUES (?, 'friend_request', ?, '/prieteni')
  `).run(target.id, req.user.name + ' ți-a trimis o cerere de prietenie');

  req.app.get('io').to('user:' + target.id).emit('notification', {
    type: 'friend_request',
    message: req.user.name + ' ți-a trimis o cerere de prietenie'
  });

  res.json({ ok: true, status: 'sent' });
});

// ------------------------------------------------------------
// POST /api/friends/accept/:id - acceptă cererea cu acest id
// ------------------------------------------------------------
router.post('/accept/:id', requireLogin, (req, res) => {
  const reqId = parseInt(req.params.id, 10);

  // Cererea trebuie să fie adresată utilizatorului curent
  const friendReq = db.prepare(
    'SELECT * FROM friend_requests WHERE id = ? AND to_user = ?'
  ).get(reqId, req.user.id);
  if (!friendReq) return res.status(404).json({ error: 'Cerere inexistentă' });

  const [a, b] = orderedPair(friendReq.from_user, friendReq.to_user);

  // Ștergem cererea și creăm prietenia (ideal într-o tranzacție)
  const accept = db.transaction(() => {
    db.prepare('DELETE FROM friend_requests WHERE id = ?').run(reqId);
    db.prepare('INSERT INTO friendships (user_a, user_b) VALUES (?, ?)').run(a, b);
  });
  accept();

  // Notificăm cel care a trimis cererea
  db.prepare(`
    INSERT INTO notifications (user_id, type, message, link)
    VALUES (?, 'friend_accepted', ?, '/prieteni')
  `).run(friendReq.from_user, req.user.name + ' ți-a acceptat cererea de prietenie');

  req.app.get('io').to('user:' + friendReq.from_user).emit('notification', {
    type: 'friend_accepted',
    message: req.user.name + ' ți-a acceptat cererea de prietenie'
  });

  res.json({ ok: true });
});

// ------------------------------------------------------------
// POST /api/friends/decline/:id - refuză cererea
// ------------------------------------------------------------
router.post('/decline/:id', requireLogin, (req, res) => {
  const reqId = parseInt(req.params.id, 10);
  const result = db.prepare(
    'DELETE FROM friend_requests WHERE id = ? AND to_user = ?'
  ).run(reqId, req.user.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Cerere inexistentă' });
  res.json({ ok: true });
});

// ------------------------------------------------------------
// GET /api/friends - prietenii curenți + cereri primite în așteptare
// ------------------------------------------------------------
router.get('/', requireLogin, (req, res) => {
  // Prietenii: oricare din cele două laturi se potrivește cu user-ul curent.
  // Cu CASE alegem id-ul celuilalt din pereche.
  const friends = db.prepare(`
    SELECT
      CASE WHEN f.user_a = ? THEN u_b.id   ELSE u_a.id   END AS id,
      CASE WHEN f.user_a = ? THEN u_b.name ELSE u_a.name END AS name,
      CASE WHEN f.user_a = ? THEN u_b.blood_type ELSE u_a.blood_type END AS blood_type,
      CASE WHEN f.user_a = ? THEN u_b.last_donation ELSE u_a.last_donation END AS last_donation
    FROM friendships f
    JOIN users u_a ON u_a.id = f.user_a
    JOIN users u_b ON u_b.id = f.user_b
    WHERE f.user_a = ? OR f.user_b = ?
    ORDER BY name ASC
  `).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);

  // Cereri primite în așteptare
  const incoming = db.prepare(`
    SELECT fr.id, fr.created_at, u.id AS from_id, u.name AS from_name, u.blood_type
    FROM friend_requests fr
    JOIN users u ON u.id = fr.from_user
    WHERE fr.to_user = ?
    ORDER BY fr.created_at DESC
  `).all(req.user.id);

  res.json({ friends, incoming });
});

// ------------------------------------------------------------
// GET /api/friends/:id/profile - profilul unui prieten
// ------------------------------------------------------------
// Întoarce aceleași date ca /api/requests/me/history dar pentru
// prietenul specificat. Acces permis DOAR dacă cei doi sunt
// prieteni (verificat în friendships). Altfel 403.
router.get('/:id/profile', requireLogin, (req, res) => {
  const friendId = parseInt(req.params.id, 10);

  // Verificăm că suntem prieteni
  if (!areFriends(req.user.id, friendId)) {
    return res.status(403).json({ error: 'Nu sunteți prieteni' });
  }

  // Datele de bază ale prietenului (fără email, fără token)
  const friend = db.prepare(`
    SELECT id, name, blood_type, last_donation
    FROM users WHERE id = ? AND role = 'donor'
  `).get(friendId);
  if (!friend) return res.status(404).json({ error: 'Utilizator inexistent' });

  // Istoricul donațiilor lui (același query ca pe profilul propriu)
  const donations = db.prepare(`
    SELECT d.donated_at, h.name AS hospital_name
    FROM donations d
    JOIN hospitals h ON h.id = d.hospital_id
    WHERE d.user_id = ?
    ORDER BY d.donated_at DESC
  `).all(friendId);

  // O donație de sânge integral poate ajuta până la 3 oameni
  const livesHelped = donations.length * 3;

  // Calculul zilelor până la următoarea donație (regula 56 zile)
  let daysUntilEligible = 0;
  if (friend.last_donation) {
    const last = new Date(friend.last_donation);
    const passed = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
    daysUntilEligible = passed >= 56 ? 0 : 56 - passed;
  }

  res.json({
    id: friend.id,
    name: friend.name,
    blood_type: friend.blood_type,
    last_donation: friend.last_donation,
    donationCount: donations.length,
    livesHelped,
    daysUntilEligible,
    donations
  });
});

// areFriends e definit mai sus (pentru request flow); îl refolosim
// pentru endpoint-ul de profil. Dacă nu există încă, îl adăugăm.
function areFriends(idA, idB) {
  const [a, b] = orderedPair(idA, idB);
  return !!db.prepare(
    'SELECT id FROM friendships WHERE user_a = ? AND user_b = ?'
  ).get(a, b);
}

module.exports = router;
