# StockWatch — Real-Time Stock Broker Dashboard

A live stock price dashboard where users log in with their email, subscribe to stocks, and watch prices update every second. no page refresh needed. Multiple users can have independent subscriptions open simultaneously.

## Features

- **Email login** — no password, just enter your email to get started
- **9 supported stocks** — GOOG, TSLA, AMZN, META, NVDA, AAPL, MSFT, NFLX, AMD
- **Live price updates** — prices update every second via WebSockets (not actual live prices, random values)
- **Per-user subscriptions** — each user independently chooses which stocks to follow
- **Multi-user** — multiple dashboards update asynchronously in real time
- **Price flash animations** — green flash on price up, red flash on price down

## Tech Stack

- **Backend** — Node.js, Express, Socket.io (uses websockets for persistent communication)
- **Frontend** — Vanilla HTML/CSS/JS (no framework, no build step)
- **Prices** — randomly generated server-side (no external API)

## Running Locally

```bash
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

alternatively, you can view the project deployed on [railway](stock-dashboard-production-89f5.up.railway.app)
