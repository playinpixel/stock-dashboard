(function () {
  const socket = io();
  const subscribedStocks = new Set();
  let currentMode = 'login'; // 'login' | 'register'

  // DOM refs — auth
  const authScreen       = document.getElementById('auth-screen');
  const emailInput       = document.getElementById('email-input');
  const passwordInput    = document.getElementById('password-input');
  const togglePwBtn      = document.getElementById('toggle-password');
  const authBtn          = document.getElementById('auth-btn');
  const authError        = document.getElementById('auth-error');
  const authSuccess      = document.getElementById('auth-success');
  const authTabs         = document.getElementById('auth-tabs');

  // DOM refs — force logout
  const forceLogoutOverlay = document.getElementById('force-logout-overlay');
  const forceLogoutReason  = document.getElementById('force-logout-reason');
  const forceLogoutOk      = document.getElementById('force-logout-ok');

  // DOM refs — dashboard
  const dashboardScreen = document.getElementById('dashboard-screen');
  const userEmailEl     = document.getElementById('user-email');
  const connectionDot   = document.getElementById('connection-dot');
  const stockGrid       = document.getElementById('stock-grid');
  const logoutBtn       = document.getElementById('logout-btn');

  // ── Connection status ──────────────────────────────────────────────
  socket.on('connect', () => setDot(true));
  socket.on('disconnect', () => setDot(false));

  function setDot(connected) {
    connectionDot.className = 'dot ' + (connected ? 'dot-green' : 'dot-red');
    connectionDot.title = connected ? 'Connected' : 'Disconnected';
  }

  // ── Auth tab toggle ────────────────────────────────────────────────
  authTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.auth-tab');
    if (!tab) return;
    const mode = tab.dataset.tab;
    if (mode === currentMode) return;
    currentMode = mode;
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === mode));
    authBtn.textContent = mode === 'login' ? 'Login' : 'Register';
    clearAuthMessages();
    passwordInput.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  });

  // ── Password visibility toggle ─────────────────────────────────────
  togglePwBtn.addEventListener('click', () => {
    const isText = passwordInput.type === 'text';
    passwordInput.type = isText ? 'password' : 'text';
    togglePwBtn.title = isText ? 'Show password' : 'Hide password';
  });

  // ── Submit (login or register) ─────────────────────────────────────
  authBtn.addEventListener('click', submitAuth);
  passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAuth(); });
  emailInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') passwordInput.focus(); });

  function submitAuth() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email) return showAuthError('Please enter your email address.');
    if (!email.includes('@')) return showAuthError('Please enter a valid email address.');
    if (!password) return showAuthError('Please enter a password.');
    if (currentMode === 'register' && password.length < 6) return showAuthError('Password must be at least 6 characters.');

    authBtn.disabled = true;
    authBtn.textContent = currentMode === 'login' ? 'Logging in…' : 'Registering…';
    clearAuthMessages();

    socket.emit(currentMode, { email, password });
  }

  function showAuthError(msg) {
    authError.textContent = msg;
    authError.hidden = false;
    authSuccess.hidden = true;
  }

  function showAuthSuccess(msg) {
    authSuccess.textContent = msg;
    authSuccess.hidden = false;
    authError.hidden = true;
  }

  function clearAuthMessages() {
    authError.hidden = true;
    authSuccess.hidden = true;
  }

  function resetAuthBtn() {
    authBtn.disabled = false;
    authBtn.textContent = currentMode === 'login' ? 'Login' : 'Register';
  }

  // ── Register response ──────────────────────────────────────────────
  socket.on('register_ack', () => {
    resetAuthBtn();
    showAuthSuccess('Account created! You can now log in.');
    passwordInput.value = '';
    // Switch to login tab
    currentMode = 'login';
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'login'));
    authBtn.textContent = 'Login';
  });

  // ── Login response ─────────────────────────────────────────────────
  socket.on('login_ack', ({ email, subscribedStocks: saved, currentPrices }) => {
    authScreen.hidden = true;
    dashboardScreen.hidden = false;
    userEmailEl.textContent = email;
    passwordInput.value = '';

    // Restore all cards; mark saved subscriptions as active
    for (const [symbol, data] of Object.entries(currentPrices)) {
      const isSubscribed = saved.includes(symbol);
      if (isSubscribed) subscribedStocks.add(symbol);
      updateCardPrice(symbol, data, isSubscribed);
    }
  });

  // ── Auth error ─────────────────────────────────────────────────────
  socket.on('auth_error', ({ message }) => {
    resetAuthBtn();
    showAuthError(message);
  });

  // ── Force logout ───────────────────────────────────────────────────
  socket.on('force_logout', ({ reason }) => {
    returnToAuth();
    forceLogoutReason.textContent = reason;
    forceLogoutOverlay.hidden = false;
  });

  forceLogoutOk.addEventListener('click', () => {
    forceLogoutOverlay.hidden = true;
  });

  // ── Manual logout ──────────────────────────────────────────────────
  logoutBtn.addEventListener('click', () => {
    socket.emit('logout');
    returnToAuth();
  });

  function returnToAuth() {
    dashboardScreen.hidden = true;
    authScreen.hidden = false;
    subscribedStocks.clear();
    // Reset all cards to unsubscribed state
    document.querySelectorAll('.stock-card').forEach(card => {
      setCardUnsubscribed(card);
    });
    clearAuthMessages();
    resetAuthBtn();
  }

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
      card.classList.add('unsubscribed');
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
    priceEl.classList.remove('flash-up', 'flash-down');
    void priceEl.offsetWidth;
    if (change > 0) priceEl.classList.add('flash-up');
    else if (change < 0) priceEl.classList.add('flash-down');
    setTimeout(() => priceEl.classList.remove('flash-up', 'flash-down'), 600);
  }
})();
