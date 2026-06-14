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

- **Backend** — Node.js, Express, Socket.io, bcrypt
- **Frontend** — Vanilla HTML/CSS/JS (no framework, no build step)
- **User storage** — `users.json` (auto-created on first run, gitignored)

## Running Locally

```bash
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

`users.json` is not included in the repo — it is created automatically by the server the first time a user registers. It stores bcrypt-hashed passwords and subscription lists.

## Deploying to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Select this repo — Railway auto-detects Node.js and runs `npm start`
4. Your app is live at the generated Railway URL

Live deployment: [stock-dashboard-production-89f5.up.railway.app](https://stock-dashboard-production-89f5.up.railway.app)

> **Note:** `users.json` is ephemeral on Railway and will be wiped on each redeploy. For persistent user storage in production, swap it out for a database (Railway offers a free PostgreSQL addon).
