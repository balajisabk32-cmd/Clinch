/**
 * In-memory data store for the Clinch reporting backend.
 *
 * Loads seed JSON at startup and resolves each deal's `createdDaysAgo` /
 * `lastActivityDaysAgo` offsets into real ISO dates relative to "now".
 * This keeps the demo deterministic (a deal always looks "8 days stalled")
 * no matter which real-world day the demo is actually run on.
 *
 * This is intentionally a plain in-memory store, not a database. It exists
 * to make Prabanjan's reporting APIs runnable standalone. Whichever
 * persistent store the team ends up using can replace loadAll() without
 * touching the reporting/services layer, which only depends on the shape
 * returned here.
 */
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function freshRequire(relPath) {
  const resolved = require.resolve(relPath);
  delete require.cache[resolved];
  return require(resolved);
}

function loadAll() {
  const customers = freshRequire(path.join(DATA_DIR, "customers.json"));
  const salesReps = freshRequire(path.join(DATA_DIR, "salesReps.json"));
  const products = freshRequire(path.join(DATA_DIR, "products.json"));
  const warehouses = freshRequire(path.join(DATA_DIR, "warehouses.json"));
  const rawDeals = freshRequire(path.join(DATA_DIR, "deals.json"));

  const deals = rawDeals.map((d) => ({
    ...d,
    createdAt: daysAgo(d.createdDaysAgo),
    lastActivityAt: daysAgo(d.lastActivityDaysAgo),
  }));

  return { customers, salesReps, products, warehouses, deals };
}

let state = loadAll();

module.exports = {
  get: () => state,
  reset: () => {
    state = loadAll();
    return state;
  },
};
