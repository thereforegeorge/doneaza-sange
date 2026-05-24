# Deploy local cu Nginx + DuckDNS

Pași pentru a pune aplicația pe serverul tău local și a o face accesibilă prin internet.

## 1. Pe serverul local (mașina pe care rulează Node)

```bash
git clone <repo>
cd web
npm install
node server.js          # ascultă pe :3000
# sau, mai bine, sub un process manager:
# npm install -g pm2
# pm2 start server.js --name doneaza-sange
# pm2 save && pm2 startup
```

## 2. Configurare DuckDNS

1. Mergi pe https://www.duckdns.org, login, creează un subdomeniu (ex. `doneaza-sange`).
2. Setează tokenul + IP-ul tău public (sau lasă DuckDNS să-l detecteze).
3. Adaugă cron-ul recomandat de DuckDNS care actualizează IP-ul la fiecare 5 minute.

## 3. Port forwarding pe router

Forward portul 80 (și 443 dacă faci HTTPS) de pe IP-ul tău public spre IP-ul serverului local pe care rulează Nginx.

## 4. Nginx

```bash
sudo apt install nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/doneaza-sange
sudo ln -s /etc/nginx/sites-available/doneaza-sange /etc/nginx/sites-enabled/
# editează fișierul și pune subdomeniul tău real în server_name
sudo nano /etc/nginx/sites-available/doneaza-sange
sudo nginx -t
sudo systemctl reload nginx
```

## 5. HTTPS gratuit (opțional dar recomandat)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d doneaza-sange.duckdns.org
```

Certbot îți cere email, acceptă ToS, alege "redirect HTTP → HTTPS". Gata.

## Verificare

- Local pe server: `curl http://localhost:3000/` (răspunde HTML)
- Prin Nginx: `curl http://localhost/` (răspunde tot HTML)
- Din afară: deschide `http://doneaza-sange.duckdns.org` în browser
- Socket.io: deschide DevTools → Network → WS. Ar trebui să vezi conexiunea WebSocket activă.

## Probleme frecvente

**"502 Bad Gateway"** – Node nu rulează sau ascultă pe alt port. Verifică `pm2 status` sau `ps aux | grep node`.

**Notificări nu apar live** – Nginx nu forward-uiește WebSocket-urile. Verifică că ai blocul `location /socket.io/` cu `Upgrade` headers din `nginx.conf`.

**Pagina merge dar API dă 404** – Probabil ai rute statice care prind `/api/*`. Nu e cazul aici (Express servește totul de pe același port), dar dacă vreodată separi frontend-ul de backend, ai grijă la ordinea blocurilor `location`.
