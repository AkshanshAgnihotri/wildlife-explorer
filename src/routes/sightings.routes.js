"use strict";

const express = require("express");
const { db } = require("../config/db");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { isNonEmptyString, validate } = require("../utils/validators");

const router = express.Router();

// GET /api/sightings?animalId=&userId=&page=&pageSize= - public feed
router.get("/", optionalAuth, (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
    const offset = (page - 1) * pageSize;

    const clauses = [];
    const params = {};
    if (req.query.animalId) {
      clauses.push("sightings.animal_id = @animalId");
      params.animalId = req.query.animalId;
    }
    if (req.query.userId) {
      clauses.push("sightings.user_id = @userId");
      params.userId = req.query.userId;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const total = db.prepare(`SELECT COUNT(*) AS c FROM sightings ${where}`).get(params).c;

    const rows = db
      .prepare(`
        SELECT
          sightings.*,
          users.username,
          animals.name AS animal_name, animals.icon AS animal_icon, animals.scientific_name
        FROM sightings
        JOIN users ON users.id = sightings.user_id
        JOIN animals ON animals.id = sightings.animal_id
        ${where}
        ORDER BY sightings.seen_on DESC, sightings.id DESC
        LIMIT @limit OFFSET @offset
      `)
      .all({ ...params, limit: pageSize, offset });

    const sightings = rows.map((row) => ({
      ...row,
      is_owner: !!(req.user && req.user.id === row.user_id),
    }));

    res.json({ total, page, pageSize, sightings });
  } catch (err) {
    next(err);
  }
});

const sightingSchema = {
  animal_id: (v) => Number.isInteger(Number(v)) && Number(v) > 0,
  location: (v) => isNonEmptyString(v, { min: 1, max: 150 }),
  seen_on: (v) => isNonEmptyString(v, { min: 1, max: 40 }),
};

router.post("/", requireAuth, (req, res, next) => {
  try {
    const body = req.body || {};
    const errors = validate(body, sightingSchema);
    if (errors.length) {
      return res.status(400).json({ error: `Invalid or missing fields: ${errors.join(", ")}` });
    }

    const animal = db.prepare("SELECT id FROM animals WHERE id = ?").get(body.animal_id);
    if (!animal) return res.status(404).json({ error: "That animal doesn't exist." });

    const info = db
      .prepare("INSERT INTO sightings (user_id, animal_id, location, seen_on, notes) VALUES (?, ?, ?, ?, ?)")
      .run(req.user.id, body.animal_id, body.location, body.seen_on, body.notes || null);

    const sighting = db.prepare("SELECT * FROM sightings WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json({ sighting });
  } catch (err) {
    next(err);
  }
});

function assertOwner(req, res) {
  const sighting = db.prepare("SELECT * FROM sightings WHERE id = ?").get(req.params.id);
  if (!sighting) {
    res.status(404).json({ error: "Sighting not found." });
    return null;
  }
  if (sighting.user_id !== req.user.id && req.user.role !== "admin") {
    res.status(403).json({ error: "You can only modify your own sightings." });
    return null;
  }
  return sighting;
}

router.put("/:id", requireAuth, (req, res, next) => {
  try {
    const sighting = assertOwner(req, res);
    if (!sighting) return;

    const merged = { ...sighting, ...req.body };
    const errors = validate(merged, sightingSchema);
    if (errors.length) {
      return res.status(400).json({ error: `Invalid or missing fields: ${errors.join(", ")}` });
    }

    db.prepare("UPDATE sightings SET location = ?, seen_on = ?, notes = ?, animal_id = ? WHERE id = ?")
      .run(merged.location, merged.seen_on, merged.notes || null, merged.animal_id, req.params.id);

    const updated = db.prepare("SELECT * FROM sightings WHERE id = ?").get(req.params.id);
    res.json({ sighting: updated });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, (req, res, next) => {
  try {
    const sighting = assertOwner(req, res);
    if (!sighting) return;

    db.prepare("DELETE FROM sightings WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
