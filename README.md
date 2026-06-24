# Deck — Project Control Center

A marketing project tracker: **projects → goals (by channel/category) → tasks (optionally linked to a goal)**.
This is a full rewrite of the original single-file `deck.html` app into a proper full-stack project.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS, broken into components |
| Backend  | Node.js + Express (REST API) |
| Database | SQLite, via Node's built-in `node:sqlite` module |
| Auth     | Email + password, JWT in an httpOnly cookie — each user only sees their own projects |

### Why `node:sqlite` instead of Prisma?

Prisma needs to download compiled query-engine binaries on `prisma generate`, and that download was blocked
in the sandbox this was built in (no access to `binaries.prisma.sh`). `node:sqlite` is built into Node.js
22.5+, needs no native compilation and no download, and is good enough for local dev. The whole database
layer lives in `server/src/db/*.js` as plain, readable SQL — if you outgrow SQLite later, that's the only
folder you'd need to rewrite (e.g. swapping in `pg` for Postgres). Every route calls these functions; no
route ever touches SQL directly.

## Project structure

```
deck-app/
├── package.json          # root: `npm run dev` starts both apps together
├── server/
│   ├── src/
│   │   ├── index.js       # Express app entrypoint
│   │   ├── constants.js   # category/period/status enums (mirrored on client)
│   │   ├── db/
│   │   │   ├── database.js  # node:sqlite connection + schema (CREATE TABLE...)
│   │   │   ├── users.js     # user queries
│   │   │   ├── projects.js  # project queries
│   │   │   ├── goals.js     # goal queries
│   │   │   └── tasks.js     # task queries
│   │   ├── middleware/auth.js   # verifies JWT cookie, sets req.userId
│   │   └── routes/
│   │       ├── auth.js        # signup, login, logout, me
│   │       ├── projects.js    # project CRUD
│   │       ├── goals.js       # goal CRUD + nudge (+/- stepper)
│   │       └── tasks.js       # task CRUD + cycle-status
│   ├── .env                # local config (DATABASE_PATH, JWT_SECRET, PORT)
│   └── dev.db               # created automatically on first run (gitignored)
└── client/
    ├── app/
    │   ├── layout.js              # wraps everything in AuthProvider
    │   ├── page.js                 # redirects to /login or /projects
    │   ├── login/page.js           # login + signup (toggle)
    │   └── projects/
    │       ├── page.js             # dashboard: grid of project cards
    │       └── [id]/page.js        # single project: goals grid + tasks list
    ├── components/
    │   ├── TopBar.jsx, AuthGuard.jsx
    │   ├── ProjectCard.jsx, GoalCard.jsx, TaskRow.jsx, Meter.jsx
    │   ├── ProjectFormModal.jsx, GoalFormModal.jsx, TaskFormModal.jsx
    │   ├── ConfirmModal.jsx, Modal.jsx, FormControls.jsx
    ├── lib/
    │   ├── api.js          # fetch wrapper, one function per API endpoint
    │   ├── AuthContext.jsx # React context: user, login, signup, logout
    │   └── constants.js    # mirrors server/src/constants.js
    ├── next.config.js      # rewrites /api/* → http://localhost:4000/api/*
    └── tailwind.config.js  # design tokens carried over from the original HTML
```

## Design tokens (carried over from the original)

- **Background:** `#14161f` (ink) shell, `#f1f2f7` (paper) content area, white cards
- **Accent:** coral signal `#ff5a38` / deep `#e0431f`
- **Category colors:** social `#7c5cfc`, ads `#1e88e5`, seo `#1fa67a`, content `#e8a23d`, email `#14b8a6`, other `#8a8fa3`
- **Type:** Space Grotesk (display), Inter (body), JetBrains Mono (labels/data)
- **Signature element:** the dashed/hatched "VU-meter" progress bar (`.meter` / `.meter-fill` in `globals.css`)

## Running it locally

### 1. Install dependencies

```bash
cd deck-app
npm run install:all
```

### 2. Set up the server environment

```bash
cd server
cp .env.example .env
# Open .env and replace JWT_SECRET with a long random string
```

### 3. Run both apps together

From the **root** `deck-app` folder:

```bash
npm run dev
```

This starts:
- Express API on **http://localhost:4000**
- Next.js app on **http://localhost:3000**

Open **http://localhost:3000** — you'll land on the login page. Create an account, and you're in.

> The SQLite database file (`server/dev.db`) is created automatically on first run. Delete it any time to
> reset all data.

### Running them separately (optional)

```bash
npm run dev:server   # just Express, on :4000
npm run dev:client   # just Next.js, on :3000
```

## How the data flows

1. Browser talks only to `http://localhost:3000` (Next.js).
2. Next.js's `rewrites()` config silently forwards anything under `/api/*` to the Express server on `:4000` —
   this means there's no CORS friction in dev and cookies travel naturally between the two.
3. Express verifies the `deck_token` httpOnly cookie on every protected route, attaches `req.userId`, and
   every query is scoped to that user (`WHERE userId = ?`), so users never see each other's projects.

## Business rules preserved from the original app

- Each **goal** has a `step` (default 1) used by the +/- buttons and by task-status syncing.
- Marking a **task** as `done` (whether by clicking the status pill to cycle it, or editing it directly)
  increases its linked goal's `currentValue` by that goal's `step`. Un-completing it decreases it back.
  Moving between `todo` and `in_progress` never touches the goal.
- Deleting a **goal** doesn't delete tasks linked to it — it just unlinks them.
- Deleting a **project** cascades: all of its goals and tasks are deleted too.

## Before deploying anywhere public

- `npm audit` flags some advisories against Next.js 14.x's package range generally; this build pins
  `14.2.35`, the specific patched release for the December 2025 RSC CVEs. If you ever expose this beyond
  local dev, re-run `npm audit` and consider moving to a current Next 15/16 release.
- Set a real, random `JWT_SECRET` in `server/.env` (don't reuse the placeholder).
- Move off SQLite (or at least off `node:sqlite`, since it's still an experimental Node API) before any
  real production use — the `server/src/db/*.js` layer is written so this is a contained change.
- Add HTTPS and set the auth cookie's `secure` flag accordingly (it already auto-enables when
  `NODE_ENV=production`).
