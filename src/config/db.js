"use strict";

const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "..", "wildlife.db");

const db = new Database(DB_PATH);

// Sensible defaults for a small single-file app
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS animals (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      name                TEXT NOT NULL,
      scientific_name     TEXT NOT NULL,
      category            TEXT NOT NULL,
      habitat             TEXT NOT NULL,
      conservation_status TEXT NOT NULL,
      icon                TEXT NOT NULL DEFAULT '🐾',
      diet                TEXT,
      lifespan            TEXT,
      population          TEXT,
      description         TEXT NOT NULL,
      fun_fact            TEXT,
      created_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      animal_id  INTEGER NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, animal_id)
    );

    CREATE TABLE IF NOT EXISTS sightings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      animal_id  INTEGER NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
      location   TEXT NOT NULL,
      seen_on    TEXT NOT NULL,
      notes      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_animals_category ON animals(category);
    CREATE INDEX IF NOT EXISTS idx_animals_habitat ON animals(habitat);
    CREATE INDEX IF NOT EXISTS idx_animals_status ON animals(conservation_status);
    CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
    CREATE INDEX IF NOT EXISTS idx_sightings_user ON sightings(user_id);
    CREATE INDEX IF NOT EXISTS idx_sightings_animal ON sightings(animal_id);
  `);
}

module.exports = { db, initSchema };
