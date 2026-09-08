# LMS Nexus

AI-Enabled Multivendor Learning Management System (CSE482L Project).

## Stack

- **Frontend:** React.js + Tailwind CSS (Vite)
- **Backend:** Node.js + Express.js
- **Database:** PostgreSQL (localhost)
- **Auth:** JWT + bcrypt
- **AI:** OpenAI-ready quiz generation, tutoring & recommendations (local fallback if no API key)

## Prerequisites

1. Node.js 18+ (Vite 8 frontend build needs Node 20+ locally)
2. PostgreSQL running locally
3. Env files: `Backend/.env` and `Frontend/.env` (copy from the `.env.example` files if missing)

Create the DB role/password if needed:

```sql
-- In psql as superuser, if needed:
ALTER USER postgres PASSWORD 'Root@1234';
```

## Setup

### Backend

```bash
cd Backend
# edit .env if your Postgres user/password differ
npm install
npm run db:init
npm run db:seed
npm run dev
```

API: `http://localhost:5000`

### Frontend

```bash
cd Frontend
# .env already points at http://localhost:5000/api
npm install
npm run dev
```

App: `http://localhost:5173`

## Deploy on shared Node.js + PostgreSQL hosting

This is the usual cPanel / Hostinger / A2 / Namecheap Node.js App + PostgreSQL setup. The host assigns the port; Express already reads `process.env.PORT`.

### 1. Create PostgreSQL in the hosting panel

Create a database, user, and password. Note:

- host (often `localhost` or a hostname they give you)
- port (`5432` unless they say otherwise)
- database name, user, password
- whether SSL is required

You usually **cannot** create a database from the app on shared hosting. Create it in the panel first.

### 2. Create the Node.js app

In **Setup Node.js App** (or similar):

- Node version: **18 or 20**
- Application root: the `Backend` folder
- Application startup file: `src/index.js`
- Application URL: your domain or a subdomain (example: `https://yourdomain.com`)

### 3. Set backend environment variables

Either upload `Backend/.env` or paste the same keys into the Node.js app **Environment Variables** UI:

```
NODE_ENV=production
PORT=<leave to the host if they set it>
HOST=0.0.0.0
CLIENT_URL=https://yourdomain.com
PUBLIC_URL=https://yourdomain.com
DB_HOST=<from panel>
DB_PORT=5432
DB_USER=<from panel>
DB_PASSWORD=<from panel>
DB_NAME=<from panel>
DB_SSL=true
SKIP_DB_CREATE=true
JWT_SECRET=<long random string>
JWT_EXPIRES_IN=7d
UPLOAD_DIR=uploads
```

Use `DB_SSL=false` if the host’s Postgres is local and does not use SSL. If they give one connection string, set `DATABASE_URL` instead of the `DB_*` fields.

### 4. Build the frontend (do this on your PC if the host is low on RAM)

```bash
cd Frontend
```

Set `Frontend/.env` **before** building (Vite bakes this in at build time):

```
VITE_API_URL=/api
```

Then:

```bash
npm install
npm run build
```

Upload the generated `Frontend/dist` folder to the server next to `Frontend` (same layout as this repo). The API will serve that `dist` folder, so one Node process hosts both the site and `/api`.

### 5. Upload and install

Upload `Backend/` and `Frontend/dist` (keep the folder names). On the server, in `Backend`:

```bash
npm install --omit=dev
npm run db:init
npm run db:seed
```

Then **Restart** the Node.js app in the panel.

### 6. Check it

- Site: `https://yourdomain.com`
- Health: `https://yourdomain.com/api/health` should return `"database":"connected"`

Demo logins (password `Root@1234`): `admin@lmsnexus.com`, `aria@lmsnexus.com`, `student@lmsnexus.com`. Change these after first login.

### Hosting notes

- Put the app on the **domain root or a subdomain**, not a subfolder like `/lms`, unless you also set Vite `base`.
- File uploads land in `Backend/uploads`. That folder must be writable.
- If the frontend is hosted separately (plain `public_html`), build with `VITE_API_URL=https://yourdomain.com/api` and set `CLIENT_URL` to the frontend origin.
- cPanel env vars override `.env` values, which is what you want in production.

## Demo accounts

Password for all: `Root@1234`

| Role | Email |
|------|-------|
| Admin | admin@lmsnexus.com |
| Instructor | aria@lmsnexus.com |
| Student | student@lmsnexus.com |

## CraftX subfolder deploy

The CraftX site stays at the domain root. LMS lives in a **subfolder** named `lms`.

| Command | Output | Use for |
|---|---|---|
| `npm run build` (in `Frontend`) | `Frontend/dist` | Standalone site (`nexus…` or Node serving `/`) |
| `npm run build:craftx` | `Frontend/dist-craftx` | CraftX host: `https://craftx.corecraftsolutions.com/lms/` |

From `LMS_Nexus` or `Frontend`:

```bash
cd Frontend
npm run build:craftx
```

Copy everything inside `Frontend/dist-craftx` into the CraftX project:

```
<craftx-root>/lms/          ← paste dist-craftx files here
<craftx-root>/lms/.htaccess ← copy deploy/craftx-lms.htaccess and rename to .htaccess
```

Site URL: `https://craftx.corecraftsolutions.com/lms/`

Change the folder name by editing `VITE_BASE` in `Frontend/.env.craftx` (example: `/nexus/`) and matching the folder + `.htaccess` `RewriteBase`.

### EPS on CraftX

EPS only allows callbacks on `craftx.corecraftsolutions.com`. On the LMS backend `.env`:

```
FRONTEND_URL=https://craftx.corecraftsolutions.com/lms
CLIENT_URL=https://craftx.corecraftsolutions.com
EPS_CALLBACK_BASE_URL=https://craftx.corecraftsolutions.com
```

Then in CraftX (Apache or Node), proxy `/api` and `/uploads` to the LMS backend (`https://nexus-back.corecraftsolutions.com`), so EPS hits:

`https://craftx.corecraftsolutions.com/api/payment/eps/callback`

## EPS on CraftX (same owner, two domains)

EPS does **not** check which server calls InitializeEPS. It only checks that `successUrl` / `failUrl` / `cancelUrl` are on the registered Base URL: `craftx.corecraftsolutions.com`.

Nexus therefore sends CraftX callback URLs, and CraftX silently forwards them to Nexus.

1. Copy `deploy/craftx-eps-bridge/api` into the **CraftX document root** so you have:

   `https://craftx.corecraftsolutions.com/api/payment/eps/...`

2. In the EPS dashboard, set the IPN URL to:

   `https://craftx.corecraftsolutions.com/api/payment/eps/ipn`

3. LMS backend `.env` (already set this way):

```
EPS_CALLBACK_BASE_URL=https://craftx.corecraftsolutions.com
FRONTEND_URL=https://nexus.corecraftsolutions.com
```

After payment, EPS returns to CraftX → proxy → Nexus API → browser lands back on Nexus checkout.

If CraftX is Node/Express, mount `deploy/craftx-eps-bridge.js` instead of the PHP folder.

## EPS course checkout

Students pay for courses through **EPS (Easy Payment System)**. Money is never credited from the browser redirect — only after a server-side Verify call or a decrypted IPN.

Register this IPN URL in the EPS merchant dashboard:

```
https://nexus-back.corecraftsolutions.com/api/payment/eps/ipn
```

Required env (see `Backend/.env.example`): `EPS_USERNAME`, `EPS_PASSWORD`, `EPS_HASH_KEY`, `EPS_MERCHANT_ID`, `EPS_STORE_ID`, `EPS_IPN_SECRET_KEY`, `EPS_CALLBACK_BASE_URL` (public HTTPS **backend** URL), `FRONTEND_URL`, `EPS_RECONCILE_KEY`.

Sweep stranded pending payments (cron, every 5–15 minutes):

```
GET https://nexus-back.corecraftsolutions.com/api/payment/eps/reconcile-pending?key=YOUR_EPS_RECONCILE_KEY
```

## Features

- Multivendor course marketplace with categories, search, filters
- Instructor course drafts, AI quiz generation, admin approval workflow
- Student enrollment, checkout, video learning, progress, certificates
- Reviews, wishlist, forums, notifications, purchase history
- Role dashboards: Student / Instructor / Admin
- AI recommendations + course Q&A chatbot
