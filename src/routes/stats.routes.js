"use strict";

const express = require("express");
const { db } = require("../config/db");

const router = express.Router();

router.get("/", (_req, res, next) => {
  try {
    const totalAnimals = db.prepare("SELECT COUNT(*) AS c FROM animals").get().c;
    const totalSightings = db.prepare("SELECT COUNT(*) AS c FROM sightings").get().c;
    const totalExplorers = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
    const atRisk = db
      .prepare(`
        SELECT COUNT(*) AS c FROM animals
        WHERE conservation_status IN ('Vulnerable', 'Endangered', 'Critically Endangered')
      `)
      .get().c;

    res.json({ totalAnimals, totalSightings, totalExplorers, atRisk });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
