const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const frontend = fs.readFileSync('index.html', 'utf8');
const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');

test('Baseline Management page and navigation entry are removed', () => {
  assert.doesNotMatch(frontend, /data-page=["']baselineManagement["']/);
  assert.doesNotMatch(frontend, /id=["']baselineManagement["']/);
  assert.doesNotMatch(frontend, /id=["']baselineTable["']/);
  assert.doesNotMatch(frontend, /renderBaselineManagement/);
});

test('removed page has no lazy route while baseline-dependent reports retain their data', () => {
  assert.doesNotMatch(frontend, /baselineManagement\s*:\s*\[['"]baseline_management/);
  assert.doesNotMatch(backend, /baselineManagement\s*:\s*\[['"]baseline_management/);
  assert.match(frontend, /reportsGenerator:\[[^\]]*['"]baseline_management['"]/);
  assert.match(backend, /reportsGenerator:\s*\[[^\]]*['"]baseline_management['"]/);
  assert.match(frontend, /baselineChanges:\{[^\n]*baselineManagement/);
  assert.match(backend, /baseline_management:\s*function\(\)\s*\{\s*return buildBaselineManagement_/);
});
