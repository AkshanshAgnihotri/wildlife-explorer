"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { db } = require("../config/db");
const { requireAuth } = require("../middleware/auth");
const { createRateLimiter } = require("../middleware/rateLimiter");
const { isValidEmail, isNonEmptyString, validate } = require("../utils/validators");

const router = express.Router();

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many auth attempts. Please wait a few minutes and try again.",
});

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function publicUser(user) {
  return { id: user.id, username: user.username, email: user.email, role: user.role };
}

router.post("/register", authLimiter, (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};

    const errors = validate(req.body || {}, {
      username: (v) => isNonEmptyString(v, { min: 3, max: 30 }),
      email: (v) => isValidEmail(v),
      password: (v) => isNonEmptyString(v, { min: 8, max: 200 }),
    });
    if (errors.length) {
      return res.status(400).json({ error: `Invalid or missing fields: ${errors.join(", ")}` });
    }

    const existing = db
      .prepare("SELECT id FROM users WHERE email = ? OR username = ?")
      .get(email.toLowerCase(), username);
    if (existing) {
      return res.status(409).json({ error: "Username or email is already taken." });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)")
      .run(username, email.toLowerCase(), passwordHash);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
    const token = signToken(user);

    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/login", authLimiter, (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!isValidEmail(email) || !isNonEmptyString(password, { min: 1, max: 200 })) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, (req, res, next) => {
  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
