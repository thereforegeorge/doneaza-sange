-- ============================================================
-- SCHEMA BAZA DE DATE - Donează Sânge
-- ============================================================
-- Aplicația conectează donatori de sânge cu spitalele care au
-- nevoie urgentă de donații. Mecanica principală:
--   1. Spitalele postează cereri (grupa, unități, urgență).
--   2. Donatorii compatibili văd cererea în feed și se angajează.
--   3. Donatorii își pot invita prietenii (cu grupa potrivită)
--      la o cerere - efectul de "rețea socială" amplifică ajunsul.
--   4. Fiecare cerere are nevoie de MINIM 3 angajamente confirmate
--      ca rezervă, în caz că unul nu se prezintă.
--
-- Autentificare: email + parolă în clar + token aleator pe login.
-- (Pentru un proiect real, parolele s-ar hash-ui cu bcrypt - aici
-- am simplificat pentru ca demo-ul să fie clar de explicat.)
-- ============================================================

-- Activăm cheile străine (în SQLite sunt dezactivate implicit)
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- USERS - donatori și personal medical (un singur tabel)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  password      TEXT    NOT NULL,                   -- în clar (vezi nota din header)
  token         TEXT    UNIQUE,                     -- token de sesiune, NULL = delogat
  name          TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK(role IN ('donor', 'hospital')),

  -- Câmpuri pentru donatori (NULL la personal medical)
  blood_type    TEXT    CHECK(blood_type IN ('O-','O+','A-','A+','B-','B+','AB-','AB+')),
  last_donation TEXT,                               -- ISO 8601: 'YYYY-MM-DD'
  city          TEXT,
  lat           REAL,
  lng           REAL,

  -- Câmp pentru personal medical (NULL la donatori)
  hospital_id   INTEGER REFERENCES hospitals(id),

  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Căutare după token la fiecare request autentificat
CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);

-- ------------------------------------------------------------
-- HOSPITALS - spitalele care pot posta cereri
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospitals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  address    TEXT    NOT NULL,
  city       TEXT    NOT NULL,
  lat        REAL    NOT NULL,
  lng        REAL    NOT NULL,
  phone      TEXT,
  verified   INTEGER NOT NULL DEFAULT 0,            -- 0 = neverificat, 1 = verificat
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- REQUESTS - cereri de sânge postate de spitale
-- ------------------------------------------------------------
-- Statusuri:
--   open    = caută donatori (sub 3 angajamente)
--   covered = are >= 3 angajamente confirmate (acceptă rezerve)
--   closed  = deadline trecut sau închisă manual
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  hospital_id  INTEGER NOT NULL REFERENCES hospitals(id),
  blood_type   TEXT    NOT NULL,
  units_needed INTEGER NOT NULL DEFAULT 1,
  urgency      TEXT    NOT NULL CHECK(urgency IN ('urgent','planned')),
  deadline     TEXT    NOT NULL,                    -- 'YYYY-MM-DD HH:MM'
  notes        TEXT,
  status       TEXT    NOT NULL DEFAULT 'open' CHECK(status IN ('open','covered','closed')),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Indexul ajută la afișarea rapidă a cererilor active în feed-ul
-- fiecărui donator. NU expune o listă publică - feed-ul cere login.
CREATE INDEX IF NOT EXISTS idx_requests_active ON requests(status, deadline);

-- ------------------------------------------------------------
-- PLEDGES - angajamente ale donatorilor
-- ------------------------------------------------------------
-- Statusuri:
--   pledged   = s-a angajat, urmează să doneze
--   showed_up = donația confirmată (de donator + opțional spital)
--   no_show   = nu s-a prezentat
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pledges (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id          INTEGER NOT NULL REFERENCES requests(id),
  user_id             INTEGER NOT NULL REFERENCES users(id),
  status              TEXT    NOT NULL DEFAULT 'pledged' CHECK(status IN ('pledged','showed_up','no_show')),

  -- Donatorul alege la fiecare angajament dacă numele lui e vizibil
  -- spitalului. Implicit ascuns (1 = anonim, 0 = nume vizibil).
  is_anonymous        INTEGER NOT NULL DEFAULT 1,

  -- Cele două confirmări - când ambele sunt 1, se creează donation
  donor_confirmed     INTEGER NOT NULL DEFAULT 0,
  hospital_confirmed  INTEGER NOT NULL DEFAULT 0,

  pledged_at          TEXT    NOT NULL DEFAULT (datetime('now')),

  -- Un donator nu se poate angaja de două ori pe aceeași cerere
  UNIQUE(request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pledges_request ON pledges(request_id);
CREATE INDEX IF NOT EXISTS idx_pledges_user    ON pledges(user_id);

-- ------------------------------------------------------------
-- FRIENDSHIPS - relații între donatori
-- ------------------------------------------------------------
-- Cerere acceptată = prietenie activă. Stocăm o singură linie
-- per pereche, normalizată cu user_a < user_b (ordonarea pe id).
-- Așa evităm dubluri și nu trebuie să întrebăm "în ce direcție".
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS friendships (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a     INTEGER NOT NULL REFERENCES users(id),  -- id mai mic
  user_b     INTEGER NOT NULL REFERENCES users(id),  -- id mai mare
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_a, user_b),
  CHECK(user_a < user_b)                              -- forțează ordinea
);

CREATE INDEX IF NOT EXISTS idx_friendships_a ON friendships(user_a);
CREATE INDEX IF NOT EXISTS idx_friendships_b ON friendships(user_b);

-- ------------------------------------------------------------
-- FRIEND_REQUESTS - cereri de prietenie în așteptare
-- ------------------------------------------------------------
-- Când e acceptată, mutăm înregistrarea în friendships și ștergem
-- de aici. Când e respinsă, doar ștergem.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS friend_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user   INTEGER NOT NULL REFERENCES users(id),
  to_user     INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(from_user, to_user),
  CHECK(from_user <> to_user)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_user);

-- ------------------------------------------------------------
-- INVITATIONS - "tag-uri" la cereri de sânge
-- ------------------------------------------------------------
-- Ana invită pe Mihai (prieten cu grupa potrivită) la cererea X.
-- Mihai poate accepta (se creează pledge automat) sau refuza.
-- Pentru a putea invita, cei doi trebuie să fie deja prieteni.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id  INTEGER NOT NULL REFERENCES requests(id),
  from_user   INTEGER NOT NULL REFERENCES users(id),
  to_user     INTEGER NOT NULL REFERENCES users(id),
  status      TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(request_id, to_user)                        -- un singur tag pe cerere per persoană
);

CREATE INDEX IF NOT EXISTS idx_invitations_to ON invitations(to_user, status);

-- ------------------------------------------------------------
-- NOTIFICATIONS - notificările din clopoțelul aplicației
-- ------------------------------------------------------------
-- Tipuri:
--   friend_request  = cineva ți-a trimis cerere de prietenie
--   friend_accepted = cineva ți-a acceptat cererea de prietenie
--   invitation      = un prieten te-a invitat la o cerere
--   request_covered = o cerere la care te-ai angajat e completă
--   reminder        = mâine donezi (sau în câteva ore)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  type       TEXT    NOT NULL,
  message    TEXT    NOT NULL,                       -- text gata-formatat în română
  link       TEXT,                                   -- URL relativ unde duce click-ul
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at);

-- ------------------------------------------------------------
-- DONATIONS - istoricul donațiilor confirmate
-- ------------------------------------------------------------
-- Sursa de adevăr pentru calculul perioadei de așteptare (56 zile
-- între donații de sânge integral, conform regulamentului).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id),
  request_id  INTEGER REFERENCES requests(id),     -- NULL pentru donații istorice
  donated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_donations_user ON donations(user_id, donated_at);
