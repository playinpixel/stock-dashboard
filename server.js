const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;
const USERS_FILE = path.join(__dirname, 'users.json');

const STOCKS = {
  GOOG: { base: 175.00, volatility: 3.50 },
  TSLA: { base: 250.00, volatility: 5.00 },
  AMZN: { base: 190.00, volatility: 3.80 },
  META: { base: 510.00, volatility: 10.20 },
  NVDA: { base: 870.00, volatility: 17.40 },
  AAPL: { base: 192.00, volatility: 3.84 },
  MSFT: { base: 420.00, volatility: 8.40 },
  NFLX: { base: 640.00, volatility: 12.80 },
  AMD:  { base: 160.00, volatility: 3.20 }
};

const sessions = new Map();       // socket.id → { email, subscribedStocks: Set }
const activeSessions = new Map(); // email → socket.id (one active socket per user)
const currentPrices = {};

for (const [symbol, config] of Object.entries(STOCKS)) {
  currentPrices[symbol] = { price: config.base, change: 0, changePercent: 0 };
}

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch { return {}; }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function tickPrices() {
  for (const [symbol, config] of Object.entries(STOCKS)) {
    const prev = currentPrices[symbol].price;
    const delta = (Math.random() - 0.5) * 2 * config.volatility;
    const newPrice = Math.max(0.01, prev + delta);
    const change = newPrice - prev;
    const changePercent = (change / prev) * 100;
    currentPrices[symbol] = {
      price: parseFloat(newPrice.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(3))
    };
    io.to(`stock:${symbol}`).emit('price_update', { symbol, ...currentPrices[symbol] });
  }
}

setInterval(tickPrices, 1000);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {

  socket.on('register', async ({ email, password }) => {
    if (!email || !password) {
      return socket.emit('auth_error', { message: 'Email and password are required.' });
    }
    const users = loadUsers();
    if (users[email]) {
      return socket.emit('auth_error', { message: 'An account with this email already exists.' });
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    users[email] = { passwordHash, subscribedStocks: [] };
    saveUsers(users);
    socket.emit('register_ack');
    console.log(`[+] Registered: ${email}`);
  });

  socket.on('login', async ({ email, password }) => {
    if (!email || !password) {
      return socket.emit('auth_error', { message: 'Email and password are required.' });
    }
    const users = loadUsers();
    const user = users[email];
    if (!user) {
      return socket.emit('auth_error', { message: 'No account found with this email.' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return socket.emit('auth_error', { message: 'Incorrect password.' });
    }

    // Force logout any existing active session for this email
    if (activeSessions.has(email)) {
      const oldSocketId = activeSessions.get(email);
      const oldSocket = io.sockets.sockets.get(oldSocketId);
      if (oldSocket) {
        oldSocket.emit('force_logout', { reason: 'You were signed in from another location.' });
        const oldSession = sessions.get(oldSocketId);
        if (oldSession) {
          for (const sym of oldSession.subscribedStocks) {
            oldSocket.leave(`stock:${sym}`);
          }
          sessions.delete(oldSocketId);
        }
      }
      activeSessions.delete(email);
    }

    const subscribedStocks = user.subscribedStocks || [];
    sessions.set(socket.id, { email, subscribedStocks: new Set(subscribedStocks) });
    activeSessions.set(email, socket.id);

    for (const symbol of subscribedStocks) {
      socket.join(`stock:${symbol}`);
    }

    socket.emit('login_ack', { email, subscribedStocks, currentPrices });
    console.log(`[+] Login: ${email}`);
  });

  socket.on('logout', () => {
    const session = sessions.get(socket.id);
    if (!session) return;
    if (activeSessions.get(session.email) === socket.id) {
      activeSessions.delete(session.email);
    }
    for (const sym of session.subscribedStocks) {
      socket.leave(`stock:${sym}`);
    }
    sessions.delete(socket.id);
    console.log(`[-] Logout: ${session.email}`);
  });

  socket.on('subscribe', ({ symbol }) => {
    const session = sessions.get(socket.id);
    if (!session) return socket.emit('auth_error', { message: 'Not logged in.' });
    if (!STOCKS[symbol]) return socket.emit('auth_error', { message: `Unknown symbol: ${symbol}` });

    session.subscribedStocks.add(symbol);
    socket.join(`stock:${symbol}`);

    const users = loadUsers();
    if (users[session.email]) {
      users[session.email].subscribedStocks = [...session.subscribedStocks];
      saveUsers(users);
    }

    socket.emit('subscribe_ack', { symbol, ...currentPrices[symbol] });
    console.log(`[~] ${session.email} subscribed to ${symbol}`);
  });

  socket.on('unsubscribe', ({ symbol }) => {
    const session = sessions.get(socket.id);
    if (!session) return;

    session.subscribedStocks.delete(symbol);
    socket.leave(`stock:${symbol}`);

    const users = loadUsers();
    if (users[session.email]) {
      users[session.email].subscribedStocks = [...session.subscribedStocks];
      saveUsers(users);
    }

    console.log(`[~] ${session.email} unsubscribed from ${symbol}`);
  });

  socket.on('disconnect', () => {
    const session = sessions.get(socket.id);
    if (session) {
      if (activeSessions.get(session.email) === socket.id) {
        activeSessions.delete(session.email);
      }
      sessions.delete(socket.id);
      console.log(`[-] Disconnected: ${session.email}`);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Stock dashboard running at http://localhost:${PORT}`);
});
