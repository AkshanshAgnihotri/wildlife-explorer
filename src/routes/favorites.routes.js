"use strict";

const express = require("express");
const { db } = require("../config/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

// GET /api/favorites - the current user's favorited animals
router.get("/", (req, res, next) => {
  try {
    const favorites = db
      .prepare(`
        SELECT animals.*, favorites.created_at AS favorited_at
        FROM favorites
        JOIN animals ON animals.id = favorites.animal_id
        WHERE favorites.user_id = ?
        ORDER BY favorites.created_at DESC
      `)
      .all(req.user.id);
    res.json({ count: favorites.length, favorites });
  } catch (err) {
    next(err);
  }
});

// POST /api/favorites/:animalId
router.post("/:animalId", (req, res, next) => {
  try {
    const animal = db.prepare("SELECT id FROM animals WHERE id = ?").get(req.params.animalId);
    if (!animal) return res.status(404).json({ error: "Animal not found." });

    const existing = db
      .prepare("SELECT id FROM favorites WHERE user_id = ? AND animal_id = ?")
      .get(req.user.id, req.params.animalId);
    if (existing) return res.status(409).json({ error: "Already in favorites." });

    db.prepare("INSERT INTO favorites (user_id, animal_id) VALUES (?, ?)").run(req.user.id, req.params.animalId);
    res.status(201).json({ message: "Added to favorites." });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/favorites/:animalId
router.delete("/:animalId", (req, res, next) => {
  try {
    const info = db
      .prepare("DELETE FROM favorites WHERE user_id = ? AND animal_id = ?")
      .run(req.user.id, req.params.animalId);
    if (info.changes === 0) return res.status(404).json({ error: "Not in favorites." });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
