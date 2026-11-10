"use strict";

function notFound(req, res, _next) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  console.error(err);

  if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
    return res.status(409).json({ error: "That value is already in use." });
  }

  const status = err.status || 500;
  const message = status === 500 ? "Something went wrong on our end." : err.message;
  res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
