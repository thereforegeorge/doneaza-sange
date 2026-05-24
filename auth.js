// ============================================================
// AUTENTIFICARE - middleware pentru protejarea rutelor
// ============================================================
// Fiecare cerere autentificată trebuie să trimită header-ul:
//     Authorization: Bearer <token>
// Token-ul e generat la login și stocat în coloana users.token.
// ============================================================

const crypto = require('crypto');
const db = require('./db.js');

// Generează un token aleator de 32 octeți, codificat în hex.
// Folosim crypto.randomBytes (sigur criptografic) ca să nu poată
// fi ghicit. La fiecare login se generează unul nou.
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware: caută user-ul după token, îl atașează pe req.user.
// Dacă token-ul lipsește sau e invalid, întoarce 401.
function requireLogin(req, res, next) {
  // Extragem header-ul Authorization
  const header = req.headers.authorization || '';

  // Formatul așteptat: "Bearer <token>"
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Token lipsă' });
  }
  const token = parts[1];

  // Căutăm utilizatorul cu acest token în baza de date
  const user = db.prepare('SELECT * FROM users WHERE token = ?').get(token);
  if (!user) {
    return res.status(401).json({ error: 'Token invalid' });
  }

  // Atașăm user-ul la cerere pentru a fi folosit în rute
  req.user = user;
  next();
}

// Variantă pentru rute care merg doar pentru un anumit rol
function requireRole(role) {
  return function (req, res, next) {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Acces interzis' });
    }
    next();
  };
}

module.exports = { generateToken, requireLogin, requireRole };
