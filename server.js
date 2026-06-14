const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;

const STOCKS = {
  GOOG: { base: 175.00, volatility: 3.50 },
  TSLA: { base: 250.00, volatility: 5.00 },
  AMZN: { base: 190.00, volatility: 3.80 },
  META: { base: 510.00, volatility: 10.20 },
  NVDA: { base: 870.00, volatility: 17.40 },
  AAPL: { base: 192.00, volatility: 3.84 },
  MSFT: { base: 420.00, volatility: 8.40 }
};

const sessions = new Map();
const currentPrices = {};

for (const [symbol, config] of Object.entries(STOCKS)) {
  currentPrices[symbol] = { price: config.base, change: 0, changePercent: 0 };
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
  socket.on('login', ({ email }) => {
    if (!email || typeof email !== 'string' || !email.trim()) {
      return socket.emit('error', { message: 'Valid email required' });
    }
    const trimmedEmail = email.trim();
    sessions.set(socket.id, { email: trimmedEmail, subscribedStocks: new Set() });
    socket.emit('login_ack', {
      email: trimmedEmail,
      subscribedStocks: [],
      currentPrices
    });
    console.log(`[+] ${trimmedEmail} connected (${socket.id})`);
  });

  socket.on('subscribe', ({ symbol }) => {
    const session = sessions.get(socket.id);
    if (!session) return socket.emit('error', { message: 'Not logged in' });
    if (!STOCKS[symbol]) return socket.emit('error', { message: `Unknown symbol: ${symbol}` });
    session.subscribedStocks.add(symbol);
    socket.join(`stock:${symbol}`);
    socket.emit('subscribe_ack', { symbol, ...currentPrices[symbol] });
    console.log(`[~] ${session.email} subscribed to ${symbol}`);
  });

  socket.on('unsubscribe', ({ symbol }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    session.subscribedStocks.delete(symbol);
    socket.leave(`stock:${symbol}`);
    console.log(`[~] ${session.email} unsubscribed from ${symbol}`);
  });

  socket.on('disconnect', () => {
    const session = sessions.get(socket.id);
    if (session) {
      console.log(`[-] ${session.email} disconnected`);
      sessions.delete(socket.id);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Stock dashboard running at http://localhost:${PORT}`);
});
