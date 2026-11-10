"use strict";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value) {
  return typeof value === "string" && EMAIL_RE.test(value);
}

function isNonEmptyString(value, { min = 1, max = 500 } = {}) {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

/**
 * Returns an array of missing/invalid field names, or an empty array if all pass.
 * `schema` maps field name -> validator function.
 */
function validate(body, schema) {
  const errors = [];
  for (const [field, check] of Object.entries(schema)) {
    if (!check(body[field])) errors.push(field);
  }
  return errors;
}

module.exports = { isValidEmail, isNonEmptyString, validate };
