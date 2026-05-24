// Clopoțelul de notificări:
//   GET   /api/notifications        : ultimele 20 de notificări + nr. necitite
//   POST  /api/notifications/read   : marchează toate ca citite

const express = require('express');
const db = require('../db.js');
const { requireLogin } = require('../auth.js');

const router = express.Router();

// ------------------------------------------------------------
// GET /api/notifications - notificările utilizatorului
// ------------------------------------------------------------
router.get('/', requireLogin, (req, res) => {
  const items = db.prepare(`
    SELECT id, type, message, link, is_read, created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(req.user.id);

  const unread = db.prepare(`
    SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0
  `).get(req.user.id).n;

  res.json({ items, unread });
});

// ------------------------------------------------------------
// POST /api/notifications/read - marchează toate ca citite
// ------------------------------------------------------------
router.post('/read', requireLogin, (req, res) => {
  db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ?'
  ).run(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
