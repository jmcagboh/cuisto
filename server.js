const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'cuisto.json');
const sessions = new Map();
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@cuisto.local').toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'CuistoAdmin2026!';

function loadData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], reservations: [] }, null, 2));
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(':');
  const actual = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function send(response, status, body, type = 'application/json') {
  response.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
  response.end(type === 'application/json' ? JSON.stringify(body) : body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; if (body.length > 1000000) request.destroy(); });
    request.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('JSON invalide')); } });
    request.on('error', reject);
  });
}

function getUser(request) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  return token ? sessions.get(token) : null;
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, address: user.address };
}

async function handleApi(request, response, url) {
  const data = loadData();
  if (request.method === 'POST' && url.pathname === '/api/register') {
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    if (!body.name || !email || !body.phone || !body.address || String(body.password || '').length < 6) return send(response, 400, { error: 'Tous les champs sont obligatoires et le mot de passe doit contenir 6 caractères.' });
    if (data.users.some((user) => user.email === email)) return send(response, 409, { error: 'Cet e-mail est déjà utilisé.' });
    const user = { id: crypto.randomUUID(), name: String(body.name).trim(), email, phone: String(body.phone).trim(), address: String(body.address).trim(), password: hashPassword(body.password) };
    data.users.push(user); saveData(data);
    return send(response, 201, { message: 'Compte créé.' });
  }
  if (request.method === 'POST' && url.pathname === '/api/login') {
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    let user = data.users.find((item) => item.email === email);
    const isAdmin = email === adminEmail && body.password === adminPassword;
    if (!isAdmin && (!user || !verifyPassword(body.password || '', user.password))) return send(response, 401, { error: 'E-mail ou mot de passe incorrect.' });
    user = isAdmin ? { id: 'admin', name: 'Administrateur', email: adminEmail, role: 'admin' } : user;
    const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, user);
    return send(response, 200, { token, user: publicUser(user), redirect: isAdmin ? '/admin.html' : '/index.html#reservation' });
  }
  if (request.method === 'POST' && url.pathname === '/api/reservations') {
    const user = getUser(request);
    if (!user || user.role === 'admin') return send(response, 401, { error: 'Connectez-vous pour réserver.' });
    const body = await readBody(request);
    if (!body.date || !body.time || !body.guests) return send(response, 400, { error: 'Date, heure et nombre de personnes sont obligatoires.' });
    data.reservations.push({ id: crypto.randomUUID(), userId: user.id, customer: publicUser(user), date: body.date, time: body.time, guests: Number(body.guests), note: String(body.note || '').trim(), status: 'En attente', createdAt: new Date().toISOString() });
    saveData(data); return send(response, 201, { message: 'Réservation envoyée.' });
  }
  if (request.method === 'GET' && url.pathname === '/api/reservations') {
    const user = getUser(request);
    if (!user || user.role !== 'admin') return send(response, 403, { error: 'Accès administrateur requis.' });
    return send(response, 200, { reservations: data.reservations });
  }
  if (request.method === 'PATCH' && url.pathname.startsWith('/api/reservations/')) {
    const user = getUser(request);
    if (!user || user.role !== 'admin') return send(response, 403, { error: 'Accès administrateur requis.' });
    const id = url.pathname.split('/').pop(); const body = await readBody(request);
    const reservation = data.reservations.find((item) => item.id === id);
    if (!reservation) return send(response, 404, { error: 'Réservation introuvable.' });
    reservation.status = String(body.status || reservation.status); saveData(data); return send(response, 200, { reservation });
  }
  return send(response, 404, { error: 'Route introuvable.' });
}

function serveStatic(response, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, requested);
  if (!filePath.startsWith(path.resolve(ROOT)) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(response, 404, 'Page introuvable.', 'text/plain');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
  send(response, 200, fs.readFileSync(filePath), types[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  try { if (url.pathname.startsWith('/api/')) await handleApi(request, response, url); else serveStatic(response, url.pathname); }
  catch (error) { send(response, 500, { error: 'Erreur interne du serveur.' }); }
});
server.listen(PORT, () => console.log(`Cuisto est disponible sur http://localhost:${PORT}`));
