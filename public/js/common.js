// ============================================================
// COMMON.JS - cod folosit pe toate paginile (publice + private)
// ------------------------------------------------------------
// Conține:
//   - obiectul Auth: salvează/citește token-ul din localStorage
//   - helper api() pentru $.ajax cu Authorization atașat automat
//   - clopoțelul de notificări + Socket.io live (doar dacă logat)
//   - butonul de logout
//   - helper requireLogin() pe care paginile private îl apelează
// ============================================================

const Auth = {
  getToken() { return localStorage.getItem('token'); },
  getUser() {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  },
  save(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  isLoggedIn() { return !!this.getToken(); }
};

// ------------------------------------------------------------
// Wrapper peste $.ajax care atașează automat header-ul de auth.
// Întoarce un Deferred ca $.ajax normal.
// ------------------------------------------------------------
function api(options) {
  const token = Auth.getToken();
  options.headers = options.headers || {};
  if (token) {
    options.headers['Authorization'] = 'Bearer ' + token;
  }
  if (options.data && typeof options.data === 'object' && options.type !== 'GET') {
    options.data = JSON.stringify(options.data);
    options.contentType = 'application/json';
  }
  options.dataType = 'json';
  return $.ajax(options);
}

// ------------------------------------------------------------
// requireLogin() - paginile private apelează asta la pornire.
// Dacă utilizatorul nu e autentificat, îl ducem la /login.html
// și păstrăm pagina curentă ca destinație după login (în query).
// ------------------------------------------------------------
function requireLogin() {
  if (Auth.isLoggedIn()) return true;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = '/login.html?next=' + next;
  return false;
}

// ------------------------------------------------------------
// Socket.io - inițializat doar dacă utilizatorul e logat.
// (Vizitatorii anonimi nu primesc evenimente personale.)
// ------------------------------------------------------------
let socket = null;
const currentUser = Auth.getUser();
if (currentUser) {
  socket = io();
  socket.emit('identify', { userId: currentUser.id });
}

// ------------------------------------------------------------
// Clopoțelul de notificări (doar dacă logat)
// ------------------------------------------------------------
let notificationItems = [];

function refreshBellCount() {
  if (!Auth.isLoggedIn()) return;
  api({ url: '/api/notifications', type: 'GET' }).done(function (data) {
    notificationItems = data.items;
    const $count = $('#bell-count');
    if (data.unread > 0) {
      $count.text(data.unread).show();
    } else {
      $count.hide();
    }
  });
}

$(document).on('click', '#bell-btn', function (e) {
  e.stopPropagation();
  const $panel = $('#notifications-panel');
  if ($panel.is(':hidden')) {
    renderNotifications();
    $panel.show();
    api({ url: '/api/notifications/read', type: 'POST' }).done(function () {
      $('#bell-count').hide();
    });
  } else {
    $panel.hide();
  }
});

$(document).on('click', function (e) {
  if (!$(e.target).closest('#notifications-panel, #bell-btn').length) {
    $('#notifications-panel').hide();
  }
});

function renderNotifications() {
  const $list = $('#notifications-list');
  if (notificationItems.length === 0) {
    $list.html('<p class="notification-empty">Nu ai notificări noi.</p>');
    return;
  }
  $list.empty();
  notificationItems.forEach(function (n) {
    const $item = $('<div class="notification-item"></div>');
    if (!n.is_read) $item.addClass('unread');
    if (n.link) {
      $item.html('<a href="' + n.link + '">' + n.message + '</a>');
    } else {
      $item.text(n.message);
    }
    $list.append($item);
  });
}

// Notificare în timp real (doar dacă socket-ul există)
if (socket) {
  socket.on('notification', function (n) {
    notificationItems.unshift({
      id: 0,
      type: n.type,
      message: n.message,
      link: n.link || null,
      is_read: 0,
      created_at: new Date().toISOString()
    });
    const current = parseInt($('#bell-count').text(), 10) || 0;
    $('#bell-count').text(current + 1).show();
  });
}

// ------------------------------------------------------------
// La încărcare, ascundem partea de header destinată logged-in
// dacă suntem vizitatori, și arătăm un link de "Intră în cont".
// ------------------------------------------------------------
$(function () {
  if (Auth.isLoggedIn()) {
    $('.header-anon').hide();
    $('.header-auth').show();
    refreshBellCount();
  } else {
    $('.header-anon').show();
    $('.header-auth').hide();
  }
});

// ------------------------------------------------------------
// Logout
// ------------------------------------------------------------
$(document).on('click', '#logout-btn', function () {
  api({ url: '/api/auth/logout', type: 'POST' }).always(function () {
    Auth.clear();
    window.location.href = '/';
  });
});

// ------------------------------------------------------------
// Helpere de formatare date (folosite pe mai multe pagini)
// ------------------------------------------------------------
function formatDate(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  const luni = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun',
                'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
  return d.getDate() + ' ' + luni[d.getMonth()] + ' ' + d.getFullYear();
}

function formatDateTime(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  const luni = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun',
                'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return d.getDate() + ' ' + luni[d.getMonth()] + ' ' + hh + ':' + mm;
}
