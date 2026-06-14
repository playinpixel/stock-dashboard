(function () {
  const socket = io();
  const subscribedStocks = new Set();

  // DOM refs — login
  const loginScreen = document.getElementById('login-screen');
  const emailInput  = document.getElementById('email-input');
  const loginBtn    = document.getElementById('login-btn');
  const loginError  = document.getElementById('login-error');

  // DOM refs — dashboard
  const dashboardScreen = document.getElementById('dashboard-screen');
  const userEmailEl     = document.getElementById('user-email');
  const connectionDot   = document.getElementById('connection-dot');
  const stockGrid       = document.getElementById('stock-grid');

  // ── Connection status ──────────────────────────────────────────────
  socket.on('connect', () => setDot(true));
  socket.on('disconnect', () => setDot(false));

  function setDot(connected) {
    connectionDot.className = 'dot ' + (connected ? 'dot-green' : 'dot-red');
    connectionDot.title = connected ? 'Connected' : 'Disconnected';
  }

  // ── Login ──────────────────────────────────────────────────────────
  loginBtn.addEventListener('click', submitLogin);
  emailInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitLogin(); });

  function submitLogin() {
    const email = emailInput.value.trim();
    if (!email) return showLoginError('Please enter your email address.');
    if (!email.includes('@')) return showLoginError('Please enter a valid email address.');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Connecting…';
    socket.emit('login', { email });
  }

  function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.hidden = false;
  }

  socket.on('login_ack', ({ email, currentPrices }) => {
    loginScreen.hidden = true;
    dashboardScreen.hidden = false;
    userEmailEl.textContent = email;

    // Seed all cards with current prices (shown as unsubscribed/greyed)
    for (const [symbol, data] of Object.entries(currentPrices)) {
      updateCardPrice(symbol, data, false);
    }
  });

  socket.on('error', ({ message }) => {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Enter Dashboard';
    showLoginError(message);
  });

  // ── Subscribe / Unsubscribe ────────────────────────────────────────
  stockGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.subscribe-btn');
    if (!btn) return;
    const card = btn.closest('.stock-card');
    const symbol = card.dataset.symbol;

    if (subscribedStocks.has(symbol)) {
      socket.emit('unsubscribe', { symbol });
      subscribedStocks.delete(symbol);
      setCardUnsubscribed(card);
    } else {
      socket.emit('subscribe', { symbol });
    }
  });

  socket.on('subscribe_ack', ({ symbol, price, change, changePercent }) => {
    subscribedStocks.add(symbol);
    updateCardPrice(symbol, { price, change, changePercent }, true);
  });

  // ── Live price updates ─────────────────────────────────────────────
  socket.on('price_update', ({ symbol, price, change, changePercent }) => {
    updateCardPrice(symbol, { price, change, changePercent }, true);
    flashCard(symbol, change);
  });

  // ── Helpers ────────────────────────────────────────────────────────
  function getCard(symbol) {
    return stockGrid.querySelector(`[data-symbol="${symbol}"]`);
  }

  function updateCardPrice(symbol, { price, change, changePercent }, isSubscribed) {
    const card = getCard(symbol);
    if (!card) return;

    const priceEl  = card.querySelector('.stock-price');
    const changeEl = card.querySelector('.stock-change');
    const btn      = card.querySelector('.subscribe-btn');

    if (isSubscribed) {
      priceEl.textContent = `$${price.toFixed(2)}`;

      const sign = change > 0 ? '+' : '';
      changeEl.textContent = `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`;

      changeEl.className = 'stock-change ' + (change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral');

      card.classList.remove('unsubscribed', 'subscribed-up', 'subscribed-down', 'subscribed-neutral');
      card.classList.add(change > 0 ? 'subscribed-up' : change < 0 ? 'subscribed-down' : 'subscribed-neutral');

      btn.textContent = 'Unsubscribe';
      btn.classList.add('active');
    } else {
      // Seed the price in case user subscribes later — but keep card greyed
      priceEl.dataset.seedPrice = price;
      btn.textContent = 'Subscribe';
      btn.classList.remove('active');
    }
  }

  function setCardUnsubscribed(card) {
    const priceEl  = card.querySelector('.stock-price');
    const changeEl = card.querySelector('.stock-change');
    const btn      = card.querySelector('.subscribe-btn');

    card.classList.remove('subscribed-up', 'subscribed-down', 'subscribed-neutral');
    card.classList.add('unsubscribed');

    priceEl.textContent = '--';
    changeEl.textContent = '-- (--)';
    changeEl.className = 'stock-change neutral';

    btn.textContent = 'Subscribe';
    btn.classList.remove('active');
  }

  function flashCard(symbol, change) {
    const card = getCard(symbol);
    if (!card) return;
    const priceEl = card.querySelector('.stock-price');

    // Remove existing flash classes first so re-triggering works
    priceEl.classList.remove('flash-up', 'flash-down');

    // Force reflow to restart animation
    void priceEl.offsetWidth;

    if (change > 0) priceEl.classList.add('flash-up');
    else if (change < 0) priceEl.classList.add('flash-down');

    setTimeout(() => {
      priceEl.classList.remove('flash-up', 'flash-down');
    }, 600);
  }
})();
