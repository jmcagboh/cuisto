const http = require('http');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'cuisto.json');
const sessions = new Map();
const passwordResetTokens = new Map();
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@cuisto.local').toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'CuistoAdmin2026!';
const notificationEmail = process.env.NOTIFICATION_EMAIL || adminEmail;
const publicUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const menuPrices = { 'Riz au gras': 2500, 'Akoumè avec fetri': 2000, 'Akoumè avec adémè': 2000, Pokoumè: 2000, Attiéké: 2500, Veyi: 2000, Spaghetti: 2500, 'Poisson braisé': 3000, 'Riz au poisson': 3000 };

const mailer = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    })
  : null;

function loadData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], reservations: [], messages: [], orders: [] }, null, 2));
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

async function sendPasswordResetEmail(user, token) {
  if (!mailer) return false;
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: 'Réinitialisation de votre mot de passe Cuisto',
    text: `Bonjour ${user.name},\n\nCliquez sur ce lien pour choisir un nouveau mot de passe :\n${publicUrl}/login.html?reset=${token}\n\nCe lien expire dans 30 minutes.`
  });
  return true;
}

async function sendReservationNotification(reservation) {
  if (!mailer) return;
  const { customer } = reservation;
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: notificationEmail,
      subject: `Nouvelle réservation de ${customer.name}`,
      text: [
        'Une nouvelle réservation vient d\'être reçue.',
        '',
        `Client : ${customer.name}`,
        `E-mail : ${customer.email}`,
        `Téléphone : ${customer.phone}`,
        `Adresse : ${customer.address}`,
        `Date : ${reservation.date}`,
        `Heure : ${reservation.time}`,
        `Personnes : ${reservation.guests}`,
        `Remarque : ${reservation.note || 'Aucune'}`
      ].join('\n')
    });
  } catch (error) {
    console.error(`Notification e-mail impossible : ${error.message}`);
  }
}

async function sendOrderNotification(order) {
  if (!mailer) return;
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: notificationEmail,
      subject: `Nouvelle commande de ${order.customer.name}`,
      text: [
        'Une nouvelle commande vient d\'être reçue.',
        '',
        `Client : ${order.customer.name}`,
        `E-mail : ${order.customer.email}`,
        `Téléphone : ${order.customer.phone}`,
        `Mode : ${order.fulfillment === 'livraison' ? 'Livraison' : 'À emporter'}`,
        `Paiement : ${order.paymentMethod === 'sur_place' ? 'Sur place' : 'À la livraison'}`,
        `Adresse : ${order.address || 'Non renseignée'}`,
        `Position : ${order.latitude && order.longitude ? `https://www.google.com/maps?q=${order.latitude},${order.longitude}` : 'Non renseignée'}`,
        `Plats : ${order.items.map((item) => `${item.quantity} x ${item.name}`).join(', ')}`,
        `Total : ${(order.total || 0).toLocaleString('fr-FR')} FCFA`,
        `Remarque : ${order.note || 'Aucune'}`
      ].join('\n')
    });
  } catch (error) {
    console.error(`Notification commande impossible : ${error.message}`);
  }
}

async function handleApi(request, response, url) {
  const data = loadData();
  if (request.method === 'POST' && url.pathname === '/api/contact') {
    const body = await readBody(request);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const message = String(body.message || '').trim();
    if (!name || !email || !message) return send(response, 400, { error: 'Tous les champs sont obligatoires.' });
    data.messages ??= [];
    const contactMessage = { id: crypto.randomUUID(), name, email, message, createdAt: new Date().toISOString() };
    data.messages.push(contactMessage);
    saveData(data);
    if (!mailer) return send(response, 503, { error: 'Le service de messagerie n’est pas encore configuré.' });
    try {
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: notificationEmail,
        replyTo: email,
        subject: `Message depuis Cuisto - ${name}`,
        text: `Nom : ${name}\nE-mail : ${email}\n\nMessage :\n${message}`
      });
      return send(response, 200, { message: 'Message envoyé avec succès.' });
    } catch (error) {
      console.error(`Message contact impossible : ${error.message}`);
      return send(response, 502, { error: 'Le message n’a pas pu être envoyé.' });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/register') {
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    if (!body.name || !email || String(body.password || '').length < 6) return send(response, 400, { error: 'Le nom, l’e-mail et un mot de passe de 6 caractères minimum sont obligatoires.' });
    if (data.users.some((user) => user.email === email)) return send(response, 409, { error: 'Cet e-mail est déjà utilisé.' });
    const user = { id: crypto.randomUUID(), name: String(body.name).trim(), email, phone: '', address: '', password: hashPassword(body.password) };
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
  if (request.method === 'POST' && url.pathname === '/api/forgot-password') {
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const user = data.users.find((item) => item.email === email);
    if (user && mailer) {
      const token = crypto.randomBytes(32).toString('hex');
      passwordResetTokens.set(token, { userId: user.id, expiresAt: Date.now() + 30 * 60 * 1000 });
      try { await sendPasswordResetEmail(user, token); } catch (error) { console.error(`Lien de réinitialisation impossible : ${error.message}`); }
    }
    return send(response, 200, { message: 'Si cette adresse possède un compte, un lien de réinitialisation a été envoyé.' });
  }
  if (request.method === 'POST' && url.pathname === '/api/reset-password') {
    const body = await readBody(request);
    const token = String(body.token || '');
    const reset = passwordResetTokens.get(token);
    const password = String(body.password || '');
    if (!reset || reset.expiresAt < Date.now()) return send(response, 400, { error: 'Ce lien est invalide ou expiré.' });
    if (password.length < 6) return send(response, 400, { error: 'Le mot de passe doit contenir au moins 6 caractères.' });
    const user = data.users.find((item) => item.id === reset.userId);
    if (!user) return send(response, 400, { error: 'Compte introuvable.' });
    user.password = hashPassword(password);
    saveData(data);
    passwordResetTokens.delete(token);
    return send(response, 200, { message: 'Mot de passe modifié. Vous pouvez vous connecter.' });
  }
  if (request.method === 'POST' && url.pathname === '/api/reservations') {
    const user = getUser(request);
    if (!user || user.role === 'admin') return send(response, 401, { error: 'Connectez-vous pour réserver.' });
    const body = await readBody(request);
    if (!body.date || !body.time || !body.guests) return send(response, 400, { error: 'Date, heure et nombre de personnes sont obligatoires.' });
    const reservation = { id: crypto.randomUUID(), userId: user.id, customer: publicUser(user), date: body.date, time: body.time, guests: Number(body.guests), note: String(body.note || '').trim(), status: 'En attente', createdAt: new Date().toISOString() };
    data.reservations.push(reservation);
    saveData(data);
    await sendReservationNotification(reservation);
    return send(response, 201, { message: 'Réservation envoyée.' });
  }
  if (request.method === 'POST' && url.pathname === '/api/orders') {
    const user = getUser(request);
    if (!user || user.role === 'admin') return send(response, 401, { error: 'Connectez-vous pour commander.' });
    const body = await readBody(request);
    const items = Array.isArray(body.items) ? body.items.filter((item) => menuPrices[item.name] && Number(item.quantity) > 0).map((item) => ({ name: String(item.name), quantity: Number(item.quantity), unitPrice: menuPrices[item.name] })) : [];
    const fulfillment = body.fulfillment === 'livraison' ? 'livraison' : 'emporter';
    const paymentMethod = body.paymentMethod === 'sur_place' ? 'sur_place' : 'livraison';
    const address = String(body.address || '').trim();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!items.length) return send(response, 400, { error: 'Choisissez au moins un plat.' });
    if (fulfillment === 'livraison' && !address && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) return send(response, 400, { error: 'Indiquez une adresse ou partagez votre position pour la livraison.' });
    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    data.orders ??= [];
    const order = { id: crypto.randomUUID(), userId: user.id, customer: publicUser(user), items, total, fulfillment, paymentMethod, address, latitude: Number.isFinite(latitude) ? latitude : null, longitude: Number.isFinite(longitude) ? longitude : null, note: String(body.note || '').trim(), status: 'Nouvelle', createdAt: new Date().toISOString() };
    data.orders.push(order);
    saveData(data);
    await sendOrderNotification(order);
    return send(response, 201, { message: 'Commande envoyée.' });
  }
  if (request.method === 'GET' && url.pathname === '/api/reservations') {
    const user = getUser(request);
    if (!user || user.role !== 'admin') return send(response, 403, { error: 'Accès administrateur requis.' });
    return send(response, 200, { reservations: data.reservations });
  }
  if (request.method === 'GET' && url.pathname === '/api/contact-messages') {
    const user = getUser(request);
    if (!user || user.role !== 'admin') return send(response, 403, { error: 'Accès administrateur requis.' });
    return send(response, 200, { messages: data.messages || [] });
  }
  if (request.method === 'GET' && url.pathname === '/api/orders') {
    const user = getUser(request);
    if (!user || user.role !== 'admin') return send(response, 403, { error: 'Accès administrateur requis.' });
    return send(response, 200, { orders: data.orders || [] });
  }
  if (request.method === 'PATCH' && url.pathname.startsWith('/api/orders/')) {
    const user = getUser(request);
    if (!user || user.role !== 'admin') return send(response, 403, { error: 'Accès administrateur requis.' });
    const id = url.pathname.split('/').pop(); const body = await readBody(request);
    const order = (data.orders || []).find((item) => item.id === id);
    if (!order) return send(response, 404, { error: 'Commande introuvable.' });
    order.status = String(body.status || order.status); saveData(data); return send(response, 200, { order });
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
server.listen(PORT, () => {
  console.log(`Cuisto est disponible sur http://localhost:${PORT}`);
  console.log(mailer ? `Notifications e-mail activees vers ${notificationEmail}` : 'Notifications e-mail desactivees : variables SMTP manquantes');
});
