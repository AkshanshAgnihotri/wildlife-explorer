"use strict";

const { db } = require("../config/db");
const animals = require("./seedAnimals");

/**
 * Populates the animals table on first run only. Safe to call on every
 * server start - it no-ops if animals already exist.
 */
function seedIfEmpty() {
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM animals").get();
  if (count > 0) return { seeded: false, count };

  const insert = db.prepare(`
    INSERT INTO animals
      (name, scientific_name, category, habitat, conservation_status, icon, diet, lifespan, population, description, fun_fact)
    VALUES
      (@name, @scientific_name, @category, @habitat, @conservation_status, @icon, @diet, @lifespan, @population, @description, @fun_fact)
  `);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });

  insertMany(animals);
  return { seeded: true, count: animals.length };
}

module.exports = { seedIfEmpty };
