// Rute pentru cererile de sânge:
//   - GET  /api/requests          : feed cu toate cererile deschise
//   - GET  /api/requests/:id      : detalii cerere + pledgeri (cu nume sau anonim)
//   - POST /api/requests          : creare cerere (doar pentru spitale)
//   - POST /api/requests/:id/pledge : un donator se angajează la cerere

const express = require('express');
const db = require('../db.js');
const { requireLogin, requireRole } = require('../auth.js');
const { canDonate, daysUntilEligible } = require('../helpers.js');

const router = express.Router();

// Pragul minim de pledgeri pentru ca o cerere să fie marcată "covered".
// Trei e numărul ales pentru a avea rezervă în caz că un donator
// nu se prezintă (varianta 1: backup; varianta 2: backup-de-backup).
const PLEDGE_THRESHOLD = 3;

// ------------------------------------------------------------
// GET /api/requests/public - feed PUBLIC (fără autentificare)
// ------------------------------------------------------------
// Vizitatorii anonimi pot vedea cererile pentru a se motiva să
// își facă cont. Nu primesc informații despre pledgeri (anonim sau
// nu) - doar datele de bază ale cererii.
router.get('/public', (req, res) => {
  const rows = db.prepare(`
    SELECT
      r.id, r.blood_type, r.units_needed, r.urgency, r.deadline,
      r.notes, r.status,
      h.id   AS hospital_id,
      h.name AS hospital_name,
      h.city AS hospital_city,
      h.lat  AS hospital_lat,
      h.lng  AS hospital_lng,
      (SELECT COUNT(*) FROM pledges WHERE request_id = r.id AND status <> 'no_show') AS pledge_count
    FROM requests r
    JOIN hospitals h ON h.id = r.hospital_id
    WHERE r.status IN ('open', 'covered')
    ORDER BY
      CASE r.urgency WHEN 'urgent' THEN 0 ELSE 1 END,
      r.deadline ASC
  `).all();
  res.json(rows);
});

// ------------------------------------------------------------
// GET /api/requests/me/pledges-ids - id-urile cererilor la care
// utilizatorul curent s-a angajat (pentru a marca pe feed)
// ------------------------------------------------------------
router.get('/me/pledges-ids', requireLogin, (req, res) => {
  const rows = db.prepare(`
    SELECT request_id FROM pledges
    WHERE user_id = ? AND status <> 'no_show'
  `).all(req.user.id);
  res.json(rows.map(r => r.request_id));
});

// ------------------------------------------------------------
// GET /api/requests - feed cu cererile active (logat)
// ------------------------------------------------------------
// Întoarce TOATE cererile deschise (nu doar cele compatibile cu
// grupa utilizatorului). Motivul: utilizatorul poate vedea o
// cerere de o grupă pe care nu o are, dar poate invita un prieten
// cu grupa potrivită -> efectul de rețea.
router.get('/', requireLogin, (req, res) => {
  // Selectăm cererile deschise sau acoperite (nu și cele închise).
  // JOIN cu hospitals pentru a afișa numele spitalului în card.
  const rows = db.prepare(`
    SELECT
      r.id, r.blood_type, r.units_needed, r.urgency, r.deadline,
      r.notes, r.status, r.created_at,
      h.id   AS hospital_id,
      h.name AS hospital_name,
      h.city AS hospital_city,
      h.lat  AS hospital_lat,
      h.lng  AS hospital_lng,
      (SELECT COUNT(*) FROM pledges WHERE request_id = r.id AND status <> 'no_show') AS pledge_count
    FROM requests r
    JOIN hospitals h ON h.id = r.hospital_id
    WHERE r.status IN ('open', 'covered')
    ORDER BY
      CASE r.urgency WHEN 'urgent' THEN 0 ELSE 1 END,
      r.deadline ASC
  `).all();

  // Pentru fiecare cerere, adăugăm două câmpuri calculate pe care
  // frontend-ul le va folosi pentru eticheta butonului:
  //   - canCurrentUserDonate: poate dona pentru această grupă?
  //   - alreadyPledged: e deja angajat la cererea asta?
  const u = req.user;
  const myPledges = db.prepare(`
    SELECT request_id FROM pledges WHERE user_id = ? AND status <> 'no_show'
  `).all(u.id).map(p => p.request_id);

  for (const row of rows) {
    if (u.role === 'donor') {
      row.canCurrentUserDonate = canDonate(u.blood_type, row.blood_type);
      row.alreadyPledged = myPledges.indexOf(row.id) !== -1;
    } else {
      row.canCurrentUserDonate = false;
      row.alreadyPledged = false;
    }
  }

  res.json(rows);
});

// ------------------------------------------------------------
// GET /api/requests/:id - detalii cerere (public)
// ------------------------------------------------------------
// Endpoint public. Pe lângă datele cererii, întoarce lista de
// pledgeri (anonim sau cu numele real, conform setărilor lor).
// Dacă utilizatorul e logat, întoarce și pledge-ul lui personal
// pentru a ști dacă să arate "te-ai angajat" sau "mă angajez".
//
// Citim token-ul opțional manual aici, ca să nu blocăm vizitatorii.
router.get('/:id', (req, res) => {
  const header = req.headers.authorization || '';
  const parts = header.split(' ');
  let currentUserId = null;
  if (parts.length === 2 && parts[0] === 'Bearer') {
    const user = db.prepare('SELECT id FROM users WHERE token = ?').get(parts[1]);
    if (user) currentUserId = user.id;
  }
  const id = parseInt(req.params.id, 10);

  const request = db.prepare(`
    SELECT
      r.*,
      h.name AS hospital_name,
      h.address AS hospital_address,
      h.city AS hospital_city,
      h.lat AS hospital_lat,
      h.lng AS hospital_lng,
      h.phone AS hospital_phone
    FROM requests r
    JOIN hospitals h ON h.id = r.hospital_id
    WHERE r.id = ?
  `).get(id);

  if (!request) {
    return res.status(404).json({ error: 'Cerere inexistentă' });
  }

  // Lista de pledgeri. Pentru cei anonimi nu trimitem nici un detaliu
  // care i-ar putea identifica. Pentru ceilalți, doar prenume + grupa.
  const pledgesRaw = db.prepare(`
    SELECT p.id, p.user_id, p.status, p.is_anonymous, p.donor_confirmed, p.hospital_confirmed,
           u.name, u.blood_type
    FROM pledges p
    JOIN users u ON u.id = p.user_id
    WHERE p.request_id = ?
    ORDER BY p.pledged_at ASC
  `).all(id);

  const pledges = pledgesRaw.map(p => ({
    id: p.id,
    status: p.status,
    donor_confirmed: p.donor_confirmed,
    hospital_confirmed: p.hospital_confirmed,
    display_name: p.is_anonymous ? 'Donator anonim' : p.name,
    blood_type: p.is_anonymous ? null : p.blood_type,
    is_me: currentUserId !== null && p.user_id === currentUserId
  }));

  // Verificăm dacă utilizatorul curent (dacă e logat) e deja angajat
  const myPledge = currentUserId !== null
    ? pledgesRaw.find(p => p.user_id === currentUserId)
    : null;

  res.json({
    request,
    pledges,
    threshold: PLEDGE_THRESHOLD,
    myPledge: myPledge ? {
      id: myPledge.id,
      status: myPledge.status,
      is_anonymous: !!myPledge.is_anonymous,
      donor_confirmed: !!myPledge.donor_confirmed,
      hospital_confirmed: !!myPledge.hospital_confirmed
    } : null
  });
});

// ------------------------------------------------------------
// POST /api/requests - creare cerere nouă (doar pentru spitale)
// ------------------------------------------------------------
router.post('/', requireLogin, requireRole('hospital'), (req, res) => {
  const { blood_type, units_needed, urgency, deadline, notes } = req.body;

  if (!blood_type || !units_needed || !urgency || !deadline) {
    return res.status(400).json({ error: 'Lipsesc date obligatorii' });
  }

  // hospital_id îl luăm din contul autentificat (nu din body) ca să
  // nu poată crea cereri pentru alte spitale
  const result = db.prepare(`
    INSERT INTO requests (hospital_id, blood_type, units_needed, urgency, deadline, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.hospital_id, blood_type, units_needed, urgency, deadline, notes || null);

  res.json({ id: result.lastInsertRowid });
});

// ------------------------------------------------------------
// POST /api/requests/:id/pledge - donatorul se angajează
// ------------------------------------------------------------
// Corpul cererii poate conține { is_anonymous: true/false }.
// Verificăm: utilizatorul e donator, nu e deja angajat, cererea e activă.
// Perioada de așteptare (56 zile) o lăsăm să blocheze - dacă donatorul
// nu e eligibil, întoarcem 400 cu un mesaj clar.
router.post('/:id/pledge', requireLogin, requireRole('donor'), (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const isAnonymous = req.body.is_anonymous === false ? 0 : 1;  // implicit anonim

  // Verificăm cererea
  const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(requestId);
  if (!request) return res.status(404).json({ error: 'Cerere inexistentă' });
  if (request.status === 'closed') {
    return res.status(400).json({ error: 'Cererea e închisă' });
  }

  // Verificăm perioada de așteptare a donatorului
  const wait = daysUntilEligible(req.user.last_donation);
  if (wait > 0) {
    return res.status(400).json({
      error: 'Mai sunt ' + wait + ' zile până când poți dona din nou'
    });
  }

  // Inserăm pledge-ul (UNIQUE(request_id, user_id) previne dublarea)
  try {
    db.prepare(`
      INSERT INTO pledges (request_id, user_id, is_anonymous)
      VALUES (?, ?, ?)
    `).run(requestId, req.user.id, isAnonymous);
  } catch (e) {
    return res.status(409).json({ error: 'Te-ai înscris deja la această cerere' });
  }

  // Recalculăm numărul de pledgeri și actualizăm statusul cererii
  // dacă am atins pragul de 3
  const count = db.prepare(`
    SELECT COUNT(*) AS n FROM pledges WHERE request_id = ? AND status <> 'no_show'
  `).get(requestId).n;

  if (count >= PLEDGE_THRESHOLD && request.status === 'open') {
    db.prepare("UPDATE requests SET status = 'covered' WHERE id = ?").run(requestId);

    // Notificăm pledgerii anteriori că cererea e completă
    const otherPledgers = db.prepare(`
      SELECT user_id FROM pledges WHERE request_id = ? AND user_id <> ?
    `).all(requestId, req.user.id);
    for (const p of otherPledgers) {
      db.prepare(`
        INSERT INTO notifications (user_id, type, message, link)
        VALUES (?, 'request_covered', ?, ?)
      `).run(p.user_id, 'Cererea la care te-ai înscris are 3 donatori confirmați', '/cerere.html?id=' + requestId);
    }
  }

  // Emitem evenimentul live către toți cei care urmăresc cererea
  const io = req.app.get('io');
  io.to('request:' + requestId).emit('pledge-update', {
    requestId,
    pledgeCount: count,
    covered: count >= PLEDGE_THRESHOLD
  });

  res.json({ ok: true, pledgeCount: count, covered: count >= PLEDGE_THRESHOLD });
});

// ------------------------------------------------------------
// POST /api/requests/pledge/:pledgeId/confirm-donor
// ------------------------------------------------------------
// Donatorul marchează "Am donat". Dacă spitalul a confirmat deja,
// pledge-ul trece în showed_up și se creează automat o donation.
router.post('/pledge/:pledgeId/confirm-donor', requireLogin, requireRole('donor'), (req, res) => {
  const pledgeId = parseInt(req.params.pledgeId, 10);
  const pledge = db.prepare('SELECT * FROM pledges WHERE id = ?').get(pledgeId);
  if (!pledge || pledge.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Pledge inexistent' });
  }

  db.prepare(
    'UPDATE pledges SET donor_confirmed = 1 WHERE id = ?'
  ).run(pledgeId);

  finalizePledgeIfBothConfirmed(pledgeId);
  res.json({ ok: true });
});

// ------------------------------------------------------------
// POST /api/requests/pledge/:pledgeId/confirm-hospital
// ------------------------------------------------------------
// Spitalul validează că donatorul s-a prezentat. Sursa de adevăr
// finală e spitalul (poate disputa și contra-confirma).
router.post('/pledge/:pledgeId/confirm-hospital', requireLogin, requireRole('hospital'), (req, res) => {
  const pledgeId = parseInt(req.params.pledgeId, 10);
  const pledge = db.prepare(`
    SELECT p.*, r.hospital_id FROM pledges p
    JOIN requests r ON r.id = p.request_id
    WHERE p.id = ?
  `).get(pledgeId);
  if (!pledge) return res.status(404).json({ error: 'Pledge inexistent' });

  // Spitalul curent trebuie să fie chiar cel al cererii
  if (pledge.hospital_id !== req.user.hospital_id) {
    return res.status(403).json({ error: 'Pledge-ul nu aparține spitalului tău' });
  }

  db.prepare(
    'UPDATE pledges SET hospital_confirmed = 1 WHERE id = ?'
  ).run(pledgeId);

  finalizePledgeIfBothConfirmed(pledgeId);
  res.json({ ok: true });
});

// ------------------------------------------------------------
// POST /api/requests/pledge/:pledgeId/dispute - spitalul disputa
// ------------------------------------------------------------
// Spitalul marchează un pledge ca "no_show" - donatorul nu a venit.
// Această acțiune resetează confirmările și nu creează donation.
router.post('/pledge/:pledgeId/dispute', requireLogin, requireRole('hospital'), (req, res) => {
  const pledgeId = parseInt(req.params.pledgeId, 10);
  const pledge = db.prepare(`
    SELECT p.*, r.hospital_id FROM pledges p
    JOIN requests r ON r.id = p.request_id
    WHERE p.id = ?
  `).get(pledgeId);
  if (!pledge) return res.status(404).json({ error: 'Pledge inexistent' });
  if (pledge.hospital_id !== req.user.hospital_id) {
    return res.status(403).json({ error: 'Pledge-ul nu aparține spitalului tău' });
  }

  db.prepare(`
    UPDATE pledges
    SET status = 'no_show', donor_confirmed = 0, hospital_confirmed = 0
    WHERE id = ?
  `).run(pledgeId);
  res.json({ ok: true });
});

// Helper local: dacă ambele părți au confirmat, marchează pledge-ul
// ca "showed_up", creează înregistrare în donations și actualizează
// last_donation pentru donator (pornește perioada de 56 zile).
function finalizePledgeIfBothConfirmed(pledgeId) {
  const p = db.prepare('SELECT * FROM pledges WHERE id = ?').get(pledgeId);
  if (!p || p.status !== 'pledged') return;
  if (!p.donor_confirmed || !p.hospital_confirmed) return;

  const r = db.prepare('SELECT hospital_id FROM requests WHERE id = ?').get(p.request_id);

  const finalize = db.transaction(() => {
    db.prepare("UPDATE pledges SET status = 'showed_up' WHERE id = ?").run(pledgeId);
    db.prepare(`
      INSERT INTO donations (user_id, hospital_id, request_id)
      VALUES (?, ?, ?)
    `).run(p.user_id, r.hospital_id, p.request_id);
    db.prepare(`
      UPDATE users SET last_donation = date('now') WHERE id = ?
    `).run(p.user_id);
  });
  finalize();
}

// ------------------------------------------------------------
// GET /api/requests/me/history - istoric + statistici pentru donator
// ------------------------------------------------------------
// Returnează: numărul de donații, zilele rămase din perioada de
// așteptare, lista donațiilor și pledge-urile active.
router.get('/me/history', requireLogin, requireRole('donor'), (req, res) => {
  const donations = db.prepare(`
    SELECT d.donated_at, h.name AS hospital_name
    FROM donations d
    JOIN hospitals h ON h.id = d.hospital_id
    WHERE d.user_id = ?
    ORDER BY d.donated_at DESC
  `).all(req.user.id);

  const activePledges = db.prepare(`
    SELECT p.id, p.status, p.is_anonymous, p.donor_confirmed, p.hospital_confirmed,
           r.id AS request_id, r.blood_type, r.urgency, r.deadline,
           h.name AS hospital_name
    FROM pledges p
    JOIN requests r  ON r.id = p.request_id
    JOIN hospitals h ON h.id = r.hospital_id
    WHERE p.user_id = ? AND p.status = 'pledged'
    ORDER BY r.deadline ASC
  `).all(req.user.id);

  // O donație de sânge integral poate ajuta până la 3 oameni
  // (plasmă, trombocite, globule roșii separate)
  const livesHelped = donations.length * 3;
  const wait = daysUntilEligible(req.user.last_donation);

  res.json({
    donationCount: donations.length,
    livesHelped,
    daysUntilEligible: wait,
    lastDonation: req.user.last_donation,
    donations,
    activePledges
  });
});

// ------------------------------------------------------------
// GET /api/requests/hospital/mine - cererile spitalului curent
// ------------------------------------------------------------
router.get('/hospital/mine', requireLogin, requireRole('hospital'), (req, res) => {
  const rows = db.prepare(`
    SELECT
      r.*,
      (SELECT COUNT(*) FROM pledges WHERE request_id = r.id AND status <> 'no_show') AS pledge_count
    FROM requests r
    WHERE r.hospital_id = ?
    ORDER BY r.created_at DESC
  `).all(req.user.hospital_id);
  res.json(rows);
});

module.exports = router;
