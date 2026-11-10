"use strict";

const { initSchema } = require("../config/db");
const { seedIfEmpty } = require("./seed");

initSchema();
const result = seedIfEmpty();

if (result.seeded) {
  console.log(`Seeded ${result.count} animals.`);
} else {
  console.log(`Animals table already has ${result.count} rows - skipped seeding.`);
}
