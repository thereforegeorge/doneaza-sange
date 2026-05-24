// ============================================================
// SERVER PRINCIPAL - Donează Sânge
// ============================================================
// Pornește serverul Express, atașează Socket.io pentru notificări
// în timp real, servește fișierele statice și montează rutele API.
// ============================================================

const express = require('express');
const http = require('http');
const path = require('path');
const { Server: SocketIOServer } = require('socket.io');

const db = require('./db.js');

// ------------------------------------------------------------
// Configurarea Express
// ------------------------------------------------------------
const app = express();

// Setăm "trust proxy" pentru când serverul stă în spatele unui
// reverse proxy (Nginx). Asta îi spune lui Express să creadă
// header-ele X-Forwarded-For / X-Forwarded-Proto care vin de la
// proxy - ca să știe IP-ul real al clientului și protocolul (http/https).
// Setarea e benignă pe local: dacă nu există proxy, header-ele lipsesc
// și totul funcționează la fel.
app.set('trust proxy', 1);

// Parsăm body-urile JSON pe cererile primite
app.use(express.json());

// Servim fișierele statice din folderul public/ (HTML, CSS, JS, imagini)
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------------------------------
// Server HTTP + Socket.io
// ------------------------------------------------------------
// Atașăm Socket.io pe același server HTTP ca Express. Socket.io
// va emite evenimente în timp real, ex.: când cineva se angajează
// la o cerere, toți cei care urmăresc acea cerere primesc update.
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer);

// Cand un client se conectează prin Socket.io, îl punem în camere
// pe baza ID-ului său (pentru notificări personale) și pe baza
// cererilor pe care le urmărește (pentru numărătoarea live).
io.on('connection', (socket) => {

  // Clientul trimite { userId } imediat după conectare ca să-l
  // putem identifica pentru notificările personale (clopoțel).
  socket.on('identify', (data) => {
    if (data && data.userId) {
      socket.join('user:' + data.userId);
    }
  });

  // Clientul intră într-o cameră specifică pentru o cerere când
  // o deschide, ca să primească update-uri live pentru ea.
  socket.on('watch-request', (requestId) => {
    socket.join('request:' + requestId);
  });

  socket.on('unwatch-request', (requestId) => {
    socket.leave('request:' + requestId);
  });
});

// Atașăm io la app pentru a-l accesa din rute prin req.app.get('io')
app.set('io', io);

// ------------------------------------------------------------
// Rutele API (le adăugăm pe rând, după fiecare feature)
// ------------------------------------------------------------
app.use('/api/auth',          require('./routes/auth.js'));
app.use('/api/requests',      require('./routes/requests.js'));
app.use('/api/friends',       require('./routes/friends.js'));
app.use('/api/invitations',   require('./routes/invitations.js'));
app.use('/api/notifications', require('./routes/notifications.js'));

// ------------------------------------------------------------
// Pagina principală
// ------------------------------------------------------------
// Servim index.html ca pagină implicită
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------------------------------------------------
// Pornirea serverului
// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log('Server pornit pe portul ' + PORT);
  console.log('  Local:    http://localhost:' + PORT);
  console.log('  LAN/DDNS: ascultă pe toate interfețele (0.0.0.0)');
});
