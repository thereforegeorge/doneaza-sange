-- ============================================================
-- DATE INIȚIALE (seed) - pentru demonstrație
-- ============================================================
-- Toate parolele de demo sunt "parola123" (stocate în clar pentru
-- a simplifica demonstrația - vezi comentariul din schema.sql).
-- ============================================================

-- ------------------------------------------------------------
-- Spitale reale din București (coordonate aproximative)
-- ------------------------------------------------------------
INSERT INTO hospitals (name, address, city, lat, lng, phone, verified) VALUES
  ('Spitalul Universitar de Urgență București', 'Splaiul Independenței 169', 'București', 44.4356, 26.0626, '021-318-0522', 1),
  ('Spitalul Clinic de Urgență Floreasca',      'Calea Floreasca 8',          'București', 44.4641, 26.0998, '021-599-2300', 1),
  ('Spitalul Universitar de Urgență Elias',     'B-dul Mărăști 17',           'București', 44.4720, 26.0735, '021-316-1600', 1);

-- ------------------------------------------------------------
-- Conturi pentru personalul medical (câte unul per spital)
-- ------------------------------------------------------------
INSERT INTO users (email, password, name, role, hospital_id) VALUES
  ('spital.universitar@demo.ro', 'parola123', 'Dr. Andrei Popescu',  'hospital', 1),
  ('floreasca@demo.ro',          'parola123', 'Dr. Maria Ionescu',   'hospital', 2),
  ('elias@demo.ro',              'parola123', 'Dr. Cristian Stoica', 'hospital', 3);

-- ------------------------------------------------------------
-- Contul principal de test + 5 prieteni cu grupe variate
-- ------------------------------------------------------------
-- Toate parolele = numele (test, maria, etc.) pentru demo rapid
INSERT INTO users (email, password, name, role, blood_type, last_donation, city, lat, lng) VALUES
  ('test@test.com',   'test',   'Test U.',     'donor', 'O-',  '2025-10-15', 'București', 44.4400, 26.0900),
  ('maria@maria.com', 'maria',  'Maria A.',    'donor', 'A+',  '2025-08-20', 'București', 44.4500, 26.0800),
  ('damian@damian.com', 'damian', 'Damian S.', 'donor', 'B+',  '2025-09-12', 'București', 44.4600, 26.0700),
  ('cristi@cristi.com', 'cristi', 'Cristi M.', 'donor', 'O+',  '2024-12-01', 'București', 44.4300, 26.1000),
  ('elena@elena.com', 'elena',  'Elena R.',    'donor', 'AB+', '2025-06-30', 'București', 44.4700, 26.0500),
  ('vlad@vlad.com',   'vlad',   'Vlad P.',     'donor', 'A-',  '2024-03-10', 'București', 44.4250, 26.0850);

-- ID-urile donatorilor (în ordinea inserării):
-- Test=4, Maria=5, Damian=6, Cristi=7, Elena=8, Vlad=9

-- ------------------------------------------------------------
-- Toți cei 5 sunt prieteni cu Test (id=4)
-- Tabela friendships cere user_a < user_b, deci punem 4 primul.
-- ------------------------------------------------------------
INSERT INTO friendships (user_a, user_b) VALUES
  (4, 5),   -- Test <-> Maria
  (4, 6),   -- Test <-> Damian
  (4, 7),   -- Test <-> Cristi
  (4, 8),   -- Test <-> Elena
  (4, 9);   -- Test <-> Vlad

-- ------------------------------------------------------------
-- Cereri active de sânge - 10 cereri pentru ca lista feed să
-- aibă scroll vizibil. Diverse grupe, urgențe și deadline-uri.
-- ------------------------------------------------------------
INSERT INTO requests (hospital_id, blood_type, units_needed, urgency, deadline, notes, status) VALUES
  (1, 'O-',  4, 'urgent',  '2026-06-01 18:00', 'Pacient cu hemoragie post-operatorie. E nevoie urgent.',           'open'),
  (2, 'A+',  2, 'planned', '2026-06-05 12:00', 'Operație programată săptămâna viitoare.',                          'open'),
  (3, 'AB+', 1, 'urgent',  '2026-06-02 09:00', 'Caz rar, grupă greu de găsit.',                                    'open'),
  (1, 'B+',  3, 'urgent',  '2026-06-03 14:00', 'Accident rutier - intervenție în noaptea aceasta.',                'open'),
  (2, 'O+',  5, 'planned', '2026-06-08 10:00', 'Transplant programat. Avem nevoie de mai multe unități.',          'open'),
  (3, 'A-',  2, 'urgent',  '2026-06-02 20:00', 'Pacient anemic, intervenție chirurgicală mâine dimineață.',        'open'),
  (1, 'B-',  1, 'urgent',  '2026-06-04 11:00', 'Caz pediatric. Grupă rară necesară urgent.',                       'open'),
  (2, 'AB-', 1, 'urgent',  '2026-06-03 08:00', 'Cea mai rară grupă. Apelăm la toți donatorii disponibili.',        'open'),
  (3, 'O+',  3, 'planned', '2026-06-10 15:00', 'Operație cardiacă programată.',                                    'open'),
  (1, 'A+',  2, 'planned', '2026-06-12 09:00', 'Stoc preventiv pentru weekend.',                                   'open');

-- ------------------------------------------------------------
-- O invitație existentă pentru ca Test să aibă ceva în clopoțel
-- (Maria îl invită pe Test la cererea 1 - O-, compatibil)
-- ------------------------------------------------------------
INSERT INTO invitations (request_id, from_user, to_user, status) VALUES
  (1, 5, 4, 'pending');

INSERT INTO notifications (user_id, type, message, link) VALUES
  (4, 'invitation', 'Maria A. te-a invitat să donezi pentru Spitalul Universitar', '/cerere.html?id=1');
