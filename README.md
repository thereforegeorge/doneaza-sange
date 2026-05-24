# Donează Sânge

Aplicație web pentru conectarea donatorilor de sânge cu spitalele care au nevoie urgentă de donații. Spitalele postează cereri (grupa, urgență, deadline), iar donatorii compatibili se angajează să vină. Fiecare cerere are nevoie de minim 3 angajamente ca rezervă, în caz că un donator nu se prezintă.

Mecanica socială: poți tag-ui prietenii ca să îi inviți la o cerere unde grupa lor poate ajuta, iar ei primesc o notificare privată în clopoțelul aplicației.

## Cum se rulează

```bash
npm install         # instalează dependențele
node server.js      # pornește serverul pe http://localhost:3000
```

La prima rulare, baza de date SQLite (`db/database.db`) este creată automat din `db/schema.sql` + `db/seed.sql`.

## Conturi de demonstrație

Toate parolele sunt `parola123`.

**Donatori:**
- `ana@demo.ro` (O−, are prieteni)
- `mihai@demo.ro` (A+)
- `elena@demo.ro` (B+)
- `radu@demo.ro` (AB+)
- `ioana@demo.ro` (O+)

**Spitale (personal medical):**
- `spital.universitar@demo.ro` (Spitalul Universitar București)
- `floreasca@demo.ro` (Spitalul Floreasca)
- `elias@demo.ro` (Spitalul Elias)

## Tehnologii folosite (7 din cele 8 din enunț)

| Tehnologie | Unde apare |
|------------|------------|
| **HTML5**       | toate paginile din `public/*.html`, formulare cu `required`/`type=email`/`type=date`, elemente semantice (`<main>`, `<section>`, `<article>`, `<header>`) |
| **CSS3**        | `public/css/main.css` - variabile CSS, Grid, Flexbox, animații `@keyframes` (pulse pe urgență), media queries pentru mobil, `clamp()` pentru tipografie responsivă |
| **JavaScript**  | toată logica client din `public/js/*.js` - manipularea DOM, `URLSearchParams`, `localStorage`, validări, Leaflet pentru hartă |
| **jQuery**      | folosit pentru AJAX (`$.ajax`), event handlers (`$(document).on(...)`), manipulare DOM (`$('selector').html(...)`) |
| **Node.js**     | `server.js` și toate rutele din `routes/` - Express, fs, path, crypto |
| **SQLite**      | `db/database.db` accesat prin `better-sqlite3`, schema în `db/schema.sql` (9 tabele cu chei străine) |
| **Socket.io**   | `server.js` + `public/js/common.js` - actualizări live (notificări, contor pledgeri în timp real) |

Nu am folosit Python-Flask și PHP - cele 7 tehnologii de mai sus sunt suficiente (cerința e minim 5).

## Structura fișierelor

```
.
├── server.js           # serverul Express + Socket.io
├── db.js               # exportă conexiunea SQLite
├── auth.js             # middleware-ul de autentificare (token)
├── helpers.js          # compatibilitate sanguină + cooldown 56 zile
├── package.json        # 3 dependențe: express, better-sqlite3, socket.io
│
├── db/
│   ├── init.js         # creează baza la prima rulare
│   ├── schema.sql      # 9 tabele (users, hospitals, requests, pledges,
│   │                   #   friendships, friend_requests, invitations,
│   │                   #   notifications, donations)
│   ├── seed.sql        # date de demonstrație
│   └── database.db     # baza SQLite (generată automat)
│
├── routes/
│   ├── auth.js         # signup, login, logout, me
│   ├── requests.js     # feed, detalii, creare cerere, pledge, confirmare
│   ├── friends.js      # cereri de prietenie, listare prieteni
│   ├── invitations.js  # tag-uirea prietenilor la cereri
│   └── notifications.js# clopoțelul de notificări
│
└── public/
    ├── index.html      # landing page (nepautentificat)
    ├── login.html      # autentificare
    ├── signup.html     # înregistrare donator
    ├── feed.html       # lista cererilor + harta
    ├── cerere.html     # detaliile unei cereri + pledge + invitații
    ├── prieteni.html   # gestionarea prietenilor
    ├── profil.html     # statistici personale + istoric
    ├── spital.html     # dashboard pentru personalul medical
    ├── css/main.css    # stiluri editoriale (Fraunces + Inter)
    └── js/
        ├── common.js   # auth + clopoțel + Socket.io (toate paginile)
        ├── auth.js     # logică login + signup
        ├── feed.js     # listă cereri + Leaflet
        ├── cerere.js   # detalii + pledge + invitații live
        ├── prieteni.js # gestionarea prietenilor
        ├── profil.js   # statistici personale
        └── spital.js   # dashboard spital
```

## Decizii de proiectare

**Autentificare cu token, fără bcrypt.** Parolele sunt stocate în clar pentru simplitatea demo-ului. La login se generează un token aleator (32 octeți cu `crypto.randomBytes`) stocat în coloana `users.token`. Frontend-ul îl salvează în `localStorage` și îl trimite ca header `Authorization: Bearer <token>` la fiecare apel. Într-o aplicație reală, parolele ar trebui hash-uite cu bcrypt sau argon2.

**Feed nefiltrat.** Donatorul vede TOATE cererile deschise, nu doar cele compatibile cu grupa lui. Motivul: poate să nu poată dona el direct, dar poate să aibă un prieten cu grupa potrivită pe care îl tag-uiește. Compatibilitatea afectează doar eticheta butonului ("Mă angajez" vs. "invită un prieten").

**Pragul de 3 angajamente.** Cererea trece automat în statusul `covered` la al 3-lea pledge. Donatorii suplimentari sunt în continuare bineveniți ca rezervă.

**Anonimat opțional per pledge.** Donatorul alege la fiecare angajament dacă numele lui e vizibil spitalului. Implicit e bifat "Apar ca anonim". Spitalul vede totuși contorul total.

**Confirmare dublă pentru donații.** Donația contează ca finalizată doar când AMBELE părți confirmă (donatorul apasă "Am donat" + spitalul validează). Spitalul are puterea finală: poate marca pledge-ul ca "no_show" oricând. La confirmare dublă se creează o înregistrare în `donations` și se actualizează `users.last_donation`, pornind perioada de așteptare de 56 zile.

**Hartă cu OpenStreetMap.** Leaflet + tile-uri OSM, fără API keys, fără cont. Toate spitalele au coordonate reale aproximative din București.

## Cum se testează manual

1. Pornește serverul: `node server.js`
2. Deschide http://localhost:3000
3. Apasă "Am deja cont" și autentifică-te cu `ana@demo.ro` / `parola123`
4. Vei vedea 3 cereri active. Apasă pe una.
5. Apasă "Mă angajez" - se va actualiza contorul.
6. La block-ul de jos "Cunoști pe cineva care poate dona?", apasă "Tag" pe un prieten - va primi o notificare în clopoțel.
7. Pentru a vedea efectul live: deschide în alt browser (sau fereastră privată) `mihai@demo.ro` și vei vedea pledge-ul lui Ana apărând fără refresh.
8. Pentru fluxul spital, autentifică-te ca `spital.universitar@demo.ro` și vei vedea cererile spitalului + butoanele de confirmare pe fiecare pledger.
