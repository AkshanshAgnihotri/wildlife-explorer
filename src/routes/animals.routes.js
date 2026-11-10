"use strict";

const express = require("express");
const { db } = require("../config/db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { isNonEmptyString, validate } = require("../utils/validators");

const router = express.Router();

// GET /api/animals?search=&category=&habitat=&status=&sort=name|status
router.get("/", (req, res, next) => {
  try {
    const { search, category, habitat, status, sort } = req.query;

    const clauses = [];
    const params = {};

    if (search) {
      clauses.push("(name LIKE @search OR scientific_name LIKE @search OR description LIKE @search)");
      params.search = `%${search}%`;
    }
    if (category) {
      clauses.push("category = @category");
      params.category = category;
    }
    if (habitat) {
      clauses.push("habitat = @habitat");
      params.habitat = habitat;
    }
    if (status) {
      clauses.push("conservation_status = @status");
      params.status = status;
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const orderBy = sort === "status" ? "conservation_status ASC, name ASC" : "name ASC";

    const animals = db.prepare(`SELECT * FROM animals ${where} ORDER BY ${orderBy}`).all(params);
    res.json({ count: animals.length, animals });
  } catch (err) {
    next(err);
  }
});

// GET /api/animals/facets - distinct values for building filter dropdowns
router.get("/facets", (_req, res, next) => {
  try {
    const categories = db.prepare("SELECT DISTINCT category FROM animals ORDER BY category").all().map((r) => r.category);
    const habitats = db.prepare("SELECT DISTINCT habitat FROM animals ORDER BY habitat").all().map((r) => r.habitat);
    const statuses = db
      .prepare("SELECT DISTINCT conservation_status FROM animals ORDER BY conservation_status")
      .all()
      .map((r) => r.conservation_status);
    res.json({ categories, habitats, statuses });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", (req, res, next) => {
  try {
    const animal = db.prepare("SELECT * FROM animals WHERE id = ?").get(req.params.id);
    if (!animal) return res.status(404).json({ error: "Animal not found." });
    res.json({ animal });
  } catch (err) {
    next(err);
  }
});

const animalSchema = {
  name: (v) => isNonEmptyString(v, { min: 1, max: 100 }),
  scientific_name: (v) => isNonEmptyString(v, { min: 1, max: 100 }),
  category: (v) => isNonEmptyString(v, { min: 1, max: 40 }),
  habitat: (v) => isNonEmptyString(v, { min: 1, max: 40 }),
  conservation_status: (v) => isNonEmptyString(v, { min: 1, max: 40 }),
  description: (v) => isNonEmptyString(v, { min: 1, max: 1000 }),
};

// Admin-only: add a new species to the catalog
router.post("/", requireAuth, requireAdmin, (req, res, next) => {
  try {
    const body = req.body || {};
    const errors = validate(body, animalSchema);
    if (errors.length) {
      return res.status(400).json({ error: `Invalid or missing fields: ${errors.join(", ")}` });
    }

    const info = db
      .prepare(`
        INSERT INTO animals
          (name, scientific_name, category, habitat, conservation_status, icon, diet, lifespan, population, description, fun_fact)
        VALUES
          (@name, @scientific_name, @category, @habitat, @conservation_status, @icon, @diet, @lifespan, @population, @description, @fun_fact)
      `)
      .run({
        icon: "🐾",
        diet: null,
        lifespan: null,
        population: null,
        fun_fact: null,
        ...body,
      });

    const animal = db.prepare("SELECT * FROM animals WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json({ animal });
  } catch (err) {
    next(err);
  }
});

// Admin-only: update a species
router.put("/:id", requireAuth, requireAdmin, (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM animals WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Animal not found." });

    const merged = { ...existing, ...req.body };
    const errors = validate(merged, animalSchema);
    if (errors.length) {
      return res.status(400).json({ error: `Invalid or missing fields: ${errors.join(", ")}` });
    }

    db.prepare(`
      UPDATE animals SET
        name = @name, scientific_name = @scientific_name, category = @category,
        habitat = @habitat, conservation_status = @conservation_status, icon = @icon,
        diet = @diet, lifespan = @lifespan, population = @population,
        description = @description, fun_fact = @fun_fact
      WHERE id = @id
    `).run(merged);

    const animal = db.prepare("SELECT * FROM animals WHERE id = ?").get(req.params.id);
    res.json({ animal });
  } catch (err) {
    next(err);
  }
});

// Admin-only: remove a species
router.delete("/:id", requireAuth, requireAdmin, (req, res, next) => {
  try {
    const info = db.prepare("DELETE FROM animals WHERE id = ?").run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: "Animal not found." });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
