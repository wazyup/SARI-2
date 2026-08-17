# Stakeholder Feedback Management System

## Requirements

- Node.js 20 LTS or later
- Git

## Local setup

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```

Open `http://localhost:3000`. The local database is created on your machine and is intentionally excluded from Git.

## Optional public QR access

Set `NEXT_PUBLIC_APP_URL` in `.env` to your deployed or tunnel URL before generating QR codes. Do not commit `.env`, database files, tunnel credentials, or production secrets.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@sfms.local` | `password123` |
| Department Head | `depthead@sfms.local` | `password123` |
| QA Officer | `qa@sfms.local` | `password123` |

Change the demo credentials before any real deployment.
