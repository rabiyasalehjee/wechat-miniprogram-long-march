const assert = require('assert');

// The logic we want to test
function calculateDistanceKm(steps, stepToMeter = 0.5) {
  return (steps * stepToMeter) / 1000;
}

function calculateProgress(distanceKm, targetKm = 12500) {
  const pct = (distanceKm / targetKm) * 100;
  return pct > 100 ? 100 : pct;
}

function calculateRemaining(distanceKm, targetKm = 12500) {
  const rem = targetKm - distanceKm;
  return rem < 0 ? 0 : rem;
}

// Tests
console.log("Running tests for Long March Steps logic...");

try {
  // Test 1: Distance calculation
  assert.strictEqual(calculateDistanceKm(10000), 7);
  console.log("✅ calculateDistanceKm(10000) === 7km");

  // Test 2: Progress calculation
  assert.strictEqual(calculateProgress(1250), 10);
  console.log("✅ calculateProgress(1250km) === 10%");

  // Test 3: Progress capping at 100%
  assert.strictEqual(calculateProgress(13000), 100);
  console.log("✅ calculateProgress(13000km) === 100% (Capped)");

  // Test 4: Remaining distance
  assert.strictEqual(calculateRemaining(2500), 10000);
  console.log("✅ calculateRemaining(2500km) === 10000km");

  // Test 5: Remaining distance floor at 0
  assert.strictEqual(calculateRemaining(13000), 0);
  console.log("✅ calculateRemaining(13000km) === 0km (No negative remaining)");

  console.log("🎉 All unit tests passed successfully!");
} catch (error) {
  console.error("❌ Test failed:", error.message);
  process.exit(1);
}
