(function() {
  'use strict';

  // Shadow DOM container
  const host = document.createElement('cyberguard-widget');
  host.style.cssText = 'all: initial; position: fixed; bottom: 20px; right: 20px; z-index: 2147483646;';

  let shadow;
  try {
    shadow = host.attachShadow({ mode: 'open' });
  } catch (e) { return; }

  let collapsed = true;
  let currentState = { verdict: 'unknown', riskScore: 0, totalLinks: 0, malicious: 0, suspicious: 0, safe: 0 };

  const style = document.createElement('style');
  style.textContent = `
    .cyberguard-overlay { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; }
    .shield { width: 48px; height: 48px; border-radius: 50%; border: 2px solid #374151; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: all 0.3s; background: #1f2937; user-select: none; }
    .shield:hover { transform: scale(1.1); }
    .shield.safe { background: #064e3b; border-color: #10b981; }
    .shield.warn { background: #78350f; border-color: #f59e0b; animation: pulse-amber 2s infinite; }
    .shield.danger { background: #7f1d1d; border-color: #ef4444; animation: pulse-red 1s infinite; }
    .shield.unknown { }
    @keyframes pulse-amber { 0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); } 50% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); } }
    @keyframes pulse-red { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); } 50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } }
    .panel { width: 280px; background: #111827; border: 1px solid #374151; border-radius: 12px; padding: 16px; color: #f3f4f6; box-shadow: 0 8px 32px rgba(0,0,0,0.4); margin-bottom: 8px; }
    .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .panel-title { font-size: 14px; font-weight: 600; }
    .close-btn { background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 18px; padding: 0; }
    .verdict-badge { padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; display: inline-block; }
    .verdict-badge.safe { background: #064e3b; color: #6ee7b7; }
    .verdict-badge.warn { background: #78350f; color: #fcd34d; }
    .verdict-badge.danger { background: #7f1d1d; color: #fca5a5; }
    .verdict-badge.unknown { background: #374151; color: #d1d5db; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
    .stat-item { text-align: center; }
    .stat-number { font-size: 18px; font-weight: 700; }
    .stat-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; }
    .stat-item.red .stat-number { color: #f87171; }
    .stat-item.amber .stat-number { color: #fbbf24; }
    .stat-item.green .stat-number { color: #34d399; }
    .dashboard-link { display: block; text-align: center; margin-top: 12px; padding: 8px; background: #1e40af; color: white; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 500; }
    .dashboard-link:hover { background: #1d4ed8; }
  `;

  const widget = document.createElement('div');
  widget.className = 'cyberguard-overlay';

  function getShieldClass() {
    const { verdict, malicious, suspicious } = currentState;
    if (malicious > 0) return 'danger';
    if (suspicious > 0) return 'warn';
    if (verdict === 'safe') return 'safe';
    return 'unknown';
  }

  function render() {
    const sc = getShieldClass();
    const icon = sc === 'danger' ? '\u26D4' : sc === 'warn' ? '\u26A0\uFE0F' : sc === 'safe' ? '\u2705' : '\uD83D\uDEE1\uFE0F';

    if (collapsed) {
      widget.innerHTML = `<div class="shield ${sc}" id="shield-toggle">${icon}</div>`;
    } else {
      widget.innerHTML = `
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">\uD83D\uDEE1\uFE0F CyberGuard AI</span>
            <button class="close-btn" id="close-panel">\u00D7</button>
          </div>
          <div><span class="verdict-badge ${sc}">${currentState.verdict.toUpperCase() || 'SCANNING...'}</span></div>
          <div class="stats-grid">
            <div class="stat-item green"><div class="stat-number">${currentState.safe}</div><div class="stat-label">Safe</div></div>
            <div class="stat-item amber"><div class="stat-number">${currentState.suspicious}</div><div class="stat-label">Suspicious</div></div>
            <div class="stat-item red"><div class="stat-number">${currentState.malicious}</div><div class="stat-label">Malicious</div></div>
          </div>
          <a href="#" class="dashboard-link" id="open-dashboard">Open Dashboard</a>
        </div>
        <div class="shield ${sc}" id="shield-toggle">${icon}</div>
      `;

      const closeBtn = widget.querySelector('#close-panel');
      if (closeBtn) closeBtn.addEventListener('click', () => { collapsed = true; render(); });

      const dashboardLink = widget.querySelector('#open-dashboard');
      if (dashboardLink) dashboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
      });
    }

    const toggle = widget.querySelector('#shield-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        collapsed = !collapsed;
        render();
      });
    }
  }

  render();

  shadow.appendChild(style);
  shadow.appendChild(widget);
  document.documentElement.appendChild(host);

  // Listen for updates
  window.addEventListener('cyberguard-update', (e) => {
    const summary = e.detail;
    currentState = { verdict: summary.malicious > 0 ? 'danger' : summary.suspicious > 0 ? 'warn' : 'safe', riskScore: 0, totalLinks: summary.total, malicious: summary.malicious, suspicious: summary.suspicious, safe: summary.safe };
    render();

    // Auto-expand when danger, then collapse
    if (currentState.malicious > 0) {
      collapsed = false;
      render();
      setTimeout(() => { collapsed = true; render(); }, 8000);
    }
  });
})();
