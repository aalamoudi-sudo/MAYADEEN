(function () {
  'use strict';

  var STORAGE_KEY = 'mayadeen-theme';
  var root = document.documentElement;

  function savedTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch (_) {
      return 'dark';
    }
  }

  function chartPalette(theme) {
    return theme === 'light'
      ? { text: '#526173', grid: 'rgba(16, 43, 63, .10)', tooltip: '#102b3f', tooltipText: '#ffffff' }
      : { text: '#6b7a9f', grid: 'rgba(255, 255, 255, .04)', tooltip: 'rgba(15, 18, 35, .95)', tooltipText: '#eef1ff' };
  }

  function updateCharts(theme) {
    if (!window.Chart) return;
    var palette = chartPalette(theme);
    if (window.Chart.defaults) {
      window.Chart.defaults.color = palette.text;
      window.Chart.defaults.borderColor = palette.grid;
    }
    var instances = window.Chart.instances;
    if (!instances) return;
    Object.keys(instances).forEach(function (key) {
      var chart = instances[key];
      if (!chart || !chart.options) return;
      var scales = chart.options.scales || {};
      Object.keys(scales).forEach(function (axis) {
        scales[axis].ticks = Object.assign({}, scales[axis].ticks, { color: palette.text });
        scales[axis].grid = Object.assign({}, scales[axis].grid, { color: palette.grid });
        if (scales[axis].title) scales[axis].title.color = palette.text;
      });
      var plugins = chart.options.plugins || (chart.options.plugins = {});
      if (plugins.legend) plugins.legend.labels = Object.assign({}, plugins.legend.labels, { color: palette.text });
      if (plugins.tooltip) Object.assign(plugins.tooltip, {
        backgroundColor: palette.tooltip,
        titleColor: palette.tooltipText,
        bodyColor: palette.tooltipText
      });
      chart.update('none');
    });
  }

  function syncToggle(theme) {
    var button = document.getElementById('themeToggle');
    if (!button) return;
    var light = theme === 'light';
    var label = light ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الفاتح';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', String(light));
  }

  function applyTheme(theme, persist) {
    var next = theme === 'light' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    root.style.colorScheme = next;
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, next); } catch (_) { /* Storage can be disabled. */ }
    }
    syncToggle(next);
    updateCharts(next);
    window.dispatchEvent(new CustomEvent('mayadeen:themechange', { detail: { theme: next } }));
  }

  // This script is deliberately loaded in <head> so the saved theme is painted first.
  applyTheme(savedTheme(), false);

  document.addEventListener('DOMContentLoaded', function () {
    syncToggle(root.getAttribute('data-theme'));
    var button = document.getElementById('themeToggle');
    if (button) button.addEventListener('click', function () {
      applyTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light', true);
    });
  });
}());
