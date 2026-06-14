# StockWatch — Real-Time Stock Broker Dashboard

A live stock price dashboard where users register and log in, subscribe to stocks, and watch prices update every second. No page refresh needed. Multiple users can have independent subscriptions open simultaneously.

## Features

- **Auth system** — register and login with email and password (bcrypt-hashed)
- **Single-session enforcement** — logging in from a new tab forces the previous session to log out
- **9 supported stocks** — GOOG, TSLA, AMZN, META, NVDA, AAPL, MSFT, NFLX, AMD
- **Live price updates** — prices update every second via WebSockets (randomly generated, no real API)
- **Persistent subscriptions** — subscribed stocks are saved per account and restored on next login
- **Multi-user** — multiple accounts can have dashboards open simultaneously, updating independently
- **Price flash animations** — green flash on price up, red flash on price down

## Tech Stack

- **Backend** — Node.js, Express, Socket.io, bcrypt, pg
- **Frontend** — Vanilla HTML/CSS/JS (no framework, no build step)
- **User storage** — PostgreSQL on Railway (auto-provisioned); falls back to `users.json` for local development

## Running Locally

```bash
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

`users.json` is not included in the repo. Locally it is created automatically on first register. On Railway, PostgreSQL is used instead — the `users` table is created automatically on server startup.

Alternatively, you can view the project deployed on [Railway](https://stock-dashboard-production-89f5.up.railway.app).
