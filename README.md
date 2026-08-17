# SARI 2 — Smart Store Manager PWA

A modern, installable Progressive Web App for sari-sari store and retail management. Built with Next.js, Prisma, and Chart.js.

## Features

- **Dashboard & KPIs** — Real-time sales tracking, low stock alerts, and expiration monitoring
- **Inventory Management** — Product CRUD with category filters, stock thresholds, and supplier tracking
- **Point of Sale (POS)** — Interactive checkout with cash and credit (utang) payment options
- **Utang Ledger** — Customer credit tracking with balance monitoring and payment logging
- **Predictive Analytics** — AI-powered restocking recommendations using sales history analysis
- **Reports & Export** — Filterable sales logs with CSV export
- **Notifications** — Automatic alerts for low stock and expired products
- **PWA Installable** — Works on Android, iOS, and desktop as a standalone app

## Requirements

- Node.js 20 LTS or later

## Local Setup

```bash
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

Open `http://localhost:3000`. The local database is created on your machine and is intentionally excluded from Git.

## Demo Accounts

| Role         | Email               | Password      |
|--------------|---------------------|---------------|
| Store Owner  | owner@sari2.local   | password123   |
| Store Staff  | staff@sari2.local   | password123   |

Change the demo credentials before any real deployment.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Database:** SQLite with Prisma ORM
- **Charts:** Chart.js with react-chartjs-2
- **Styling:** Custom Glassmorphic Dark-Mode CSS
- **PWA:** Web Manifest + Service Worker
