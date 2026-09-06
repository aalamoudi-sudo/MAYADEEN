const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

test('task text uses a reusable custom tooltip instead of native titles', () => {
  const rows = html.slice(html.indexOf('return `<tr onclick="openDetail('), html.indexOf("}).join('');", html.indexOf('return `<tr onclick="openDetail(')));
  assert.match(rows, /taskOverflowText\(r\.name\)/);
  assert.match(rows, /taskOverflowText\(r\.operationalDeliverable\)/);
  assert.match(rows, /taskOverflowText\(r\.followUpOwner\)/);
  assert.doesNotMatch(rows, /title=/);
});

test('tooltip eligibility is based on measured overflow and clipped items alone are focusable', () => {
  assert.match(html, /el\.scrollWidth>el\.clientWidth\+1/);
  assert.match(html, /if\(clipped\) el\.tabIndex=0/);
  assert.match(html, /else\{ el\.removeAttribute\('tabindex'\)/);
  assert.match(html, /new ResizeObserver\(refreshTaskOverflowState\)/);
});

test('singleton portal supports hover, touch, keyboard and viewport-aware positioning', () => {
  assert.match(html, /document\.body\.appendChild\(tooltip\)/);
  assert.match(html, /setTimeout\(\(\)=>openTaskTooltip\(anchor\),200\)/);
  assert.match(html, /e\.pointerType!=='touch'/);
  assert.match(html, /e\.key==='Escape'/);
  assert.match(html, /aria-describedby/);
  assert.match(html, /const fitsBelow=/);
  assert.match(html, /z-index:10000/);
});
