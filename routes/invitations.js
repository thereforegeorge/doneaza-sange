// Invitații (tag-uri) la cereri de sânge.
// Mecanica: Ana e prietenă cu Mihai. Ana vede o cerere și îl
// invită pe Mihai. Mihai vede o notificare privată în clopoțel.
// Mihai poate accepta (se creează pledge) sau refuza.

const express = require('express');
const db = require('../db.js');
const { requireLogin } = require('../auth.js');

const router = express.Router();

// Helper pentru ordonarea perechii (la fel ca în friends.js)
function orderedPair(idA, idB) {
  return idA < idB ? [idA, idB] : [idB, idA];
}

// Verifică dacă două persoane sunt prietene
function areFriends(idA, idB) {
  const [a, b] = orderedPair(idA, idB);
  return !!db.prepare(
    'SELECT id FROM friendships WHERE user_a = ? AND user_b = ?'
  ).get(a, b);
}

// ------------------------------------------------------------
// POST /api/invitations - invită un prieten la o cerere
// ------------------------------------------------------------
// Body: { request_id, friend_id }
router.post('/', requireLogin, (req, res) => {
  const { request_id, friend_id } = req.body;
  if (!request_id || !friend_id) {
    return res.status(400).json({ error: 'request_id și friend_id obligatorii' });
  }

  // Cererea trebuie să existe și să fie activă
  const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(request_id);
  if (!request) return res.status(404).json({ error: 'Cerere inexistentă' });
  if (request.status === 'closed') {
    return res.status(400).json({ error: 'Cererea e închisă' });
  }

  // Prietenul trebuie să fie chiar prieten (nu altcineva)
  if (!areFriends(req.user.id, friend_id)) {
    return res.status(403).json({ error: 'Poți invita doar prieteni' });
  }

  // Inserăm invitația (UNIQUE(request_id, to_user) previne duplicate)
  try {
    db.prepare(`
      INSERT INTO invitations (request_id, from_user, to_user)
      VALUES (?, ?, ?)
    `).run(request_id, req.user.id, friend_id);
  } catch (e) {
    return res.status(409).json({ error: 'L-ai invitat deja' });
  }

  // Aflăm spitalul pentru mesajul de notificare
  const hospitalName = db.prepare(
    'SELECT name FROM hospitals WHERE id = ?'
  ).get(request.hospital_id).name;

  const msg = req.user.name + ' te-a invitat să donezi pentru ' + hospitalName;
  db.prepare(`
    INSERT INTO notifications (user_id, type, message, link)
    VALUES (?, 'invitation', ?, ?)
  `).run(friend_id, msg, '/cerere/' + request_id);

  req.app.get('io').to('user:' + friend_id).emit('notification', {
    type: 'invitation',
    message: msg
  });

  res.json({ ok: true });
});

// ------------------------------------------------------------
// GET /api/invitations - invitațiile primite (pending)
// ------------------------------------------------------------
router.get('/', requireLogin, (req, res) => {
  const rows = db.prepare(`
    SELECT
      i.id, i.request_id, i.status, i.created_at,
      u.name AS from_name,
      r.blood_type, r.urgency, r.deadline,
      h.name AS hospital_name
    FROM invitations i
    JOIN users u     ON u.id = i.from_user
    JOIN requests r  ON r.id = i.request_id
    JOIN hospitals h ON h.id = r.hospital_id
    WHERE i.to_user = ? AND i.status = 'pending'
    ORDER BY i.created_at DESC
  `).all(req.user.id);

  res.json(rows);
});

// ------------------------------------------------------------
// POST /api/invitations/:id/decline - refuză invitația
// ------------------------------------------------------------
// Nu creăm pledge automat la accept - donatorul intră tot prin
// pagina cererii și apasă "Mă angajez" cu opțiunea de anonimat.
// Aici doar marcăm invitația ca acceptată/refuzată ca să dispară
// din clopoțel.
router.post('/:id/decline', requireLogin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = db.prepare(`
    UPDATE invitations SET status = 'declined'
    WHERE id = ? AND to_user = ? AND status = 'pending'
  `).run(id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Invitație inexistentă' });
  res.json({ ok: true });
});

router.post('/:id/accept', requireLogin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = db.prepare(`
    UPDATE invitations SET status = 'accepted'
    WHERE id = ? AND to_user = ? AND status = 'pending'
  `).run(id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Invitație inexistentă' });
  res.json({ ok: true });
});

module.exports = router;
