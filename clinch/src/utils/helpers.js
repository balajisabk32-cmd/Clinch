function round1(n) {
  return Math.round(n * 10) / 10;
}

function average(nums) {
  if (!nums.length) return 0;
  return round1(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function byId(list) {
  const map = new Map();
  for (const item of list) map.set(item.id, item);
  return map;
}

function daysSince(isoDateString) {
  const then = new Date(isoDateString).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

module.exports = { round1, average, byId, daysSince };
