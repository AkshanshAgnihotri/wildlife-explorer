"use strict";

require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
 
const { initSchema } = require("./src/config/db");
const { seedIfEmpty } = require("./src/data/seed");
const { notFound, errorHandler } = require("./src/middleware/errorHandler");

const authRoutes = require("./src/routes/auth.routes");
const animalsRoutes = require("./src/routes/animals.routes");
const favoritesRoutes = require("./src/routes/favorites.routes");
const sightingsRoutes = require("./src/routes/sightings.routes");
const statsRoutes = require("./src/routes/stats.routes");

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET. Copy .env.example to .env and set one before starting the server.");
  process.exit(1);
}

initSchema();
const seedResult = seedIfEmpty();
if (seedResult.seeded) console.log(`Seeded database with ${seedResult.count} animals.`);

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/animals", animalsRoutes);
app.use("/api/favorites", favoritesRoutes);
app.use("/api/sightings", sightingsRoutes);
app.use("/api/stats", statsRoutes);

app.get("/api/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// Static frontend
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// 404 for unmatched API routes, then fall back to index.html for the SPA
app.use("/api", notFound);
app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

app.use(errorHandler);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Wildlife Explorer running at http://localhost:${PORT}`);
});
