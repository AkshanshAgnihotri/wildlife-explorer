 # Wildlife Explorer

A full-stack wildlife catalog and field sighting tracker. Browse a database
of species, save favorites, and log your own wildlife sightings in a
community feed — built with a real REST API, authentication, and a
relational database.

## Stack  

- **Backend:** Node.js, Express, SQLite (`better-sqlite3`)
- **Auth:** JWT (JSON Web Tokens) with bcrypt password hashing, role-based
  access control (`user` / `admin`)
- **Frontend:** Vanilla HTML, CSS, and JavaScript (no framework, no 
 
  step) — served as static files by the same Express app
- **No external services required** — everything runs from a single
  SQLite file on disk
 
## Features
 
- **Species catalog** — 24 seeded animals with search and filters
  (category, habitat, conservation status)
- **Accounts** — register/login with JWT-based sessions
- **Favorites** — logged-in users can save and unsave species
- **Community sightings feed** — anyone logged in can log a real sighting
  (species, location, date, notes); the public feed is paginated and each
  user can edit/delete their own entries
- **Admin route33333333s** — `POST/PUT/DELETE /api/animals/*` are restricted to
  users with the `admin` role, demonstrating role-based access control
- **Basic hardening** — input validation on every write route, a
  dependency-free rate limiter on the auth endpoints, and HTML-escaping on
  all user-submitted content rendered in the UI

## Project structure

wildlife-explorer/
├── server.js                 # Express app entry point
├── src/        
│   ├── config/db.js          # SQLite connection + schema
│   ├── data/                 # Seed data + seeding logic
│   ├── middleware/           # auth, error handling, rate limiting
│   ├── routes/                # auth, animals, favorites, sightings, stats
│   └── utils/validators.js
└── public/                   # Static frontend (served by Express)
    ├── index.html
    ├── css/style.css
    └── js/{api.js, app.js}
---
## Running it locally
+
Requires Node.js 18+.

```bash
cd wildlife-explorer
npm install
cp .env.example .env      # then edit JWT_SECRET to any long random string
npm run dev       t         # or: npm start
```
 
Open **http://localhost:3000**. The SQLite database (`wildlife.db`) and its
24 seed animals are created automatically the first time the server starts
— no separate setup step needed. (`npm run seed` also exists if you ever
want to run seeding manually.)

## Creating an admin user

Every new signup is a regular `user`. To promote one to `admin` (so you can
add/edit/delete species), stop the server and run:

```bash
sqlite3 wildlife.db "UPDATE users SET role = 'admin' WHERE email = 'you@example.com';"
```

## API overview

| Method | Route                      | Auth        | Description                          |
|--------|-----------------------------|-------------|---------------------------------------|
| POST   | `/api/auth/register`        | —           | Create an account                     |
| POST   | `/api/auth/login`           | —           | Log in, returns a JWT                 |
| GET    | `/api/auth/me`               | user        | Current user profile                  |
| GET    | `/api/animals`               | —           | List/search/filter animals            |
| GET    | `/api/animals/facets`        | —           | Distinct categories/habitats/statuses |
| GET    | `/api/animals/:id`           | —           | Single animal                         |
| POST/PUT/DELETE | `/api/animals[/:id]` | admin       | Manage the catalog                    |
| GET    | `/api/favorites`             | user        | Your saved animals                    |
| POST/DELETE | `/api/favorites/:id`    | user        | Save / remove a favorite              |
| GET    | `/api/sightings`             | —           | Public, paginated sightings feed      |
| POST   | `/api/sightings`             | user        | Log a sighting                        |
| PUT/DELETE | `/api/sightings/:id`     | owner/admin | Edit or delete your sighting          |
| GET    | `/api/stats`                  | —           | Homepage summary counters             |

## D

This is a single Node process serving both the API and the frontend, so it
deploys as one web service — no separate frontend/backend hosting needed.

**Render / Railway / Fly.io (any Node host):**
1. Push this project to a Git repo.
2. Create a new web service pointing at the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Set environment variables `JWT_SECRET` (required) and optionally `PORT`.
5. Note: SQLite writes to the local filesystem, so use a host with a
   persistent disk/volume (Render's persistent disks, Fly volumes, etc.) —
   otherwise the database resets on every redeploy.

For a resume/portfolio demo, Render's free web service tier with a small
persistent disk works well.

## Notes on the data

The seeded conservation statuses are illustrative for this demo and should
be refreshed from a live source (e.g. the IUCN Red List API) before using
this for anything beyond a portfolio project.

## Possible next steps

- Swap the in-memory rate limiter for a Redis-backed one before scaling to
  multiple instances
- Add image uploads for sightings
- Add an admin dashboard UI (the API already supports it)
- Add tests (Jest + supertest) around the route handlers
