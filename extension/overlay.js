(function() {
  'use strict';

  const currentUrl = window.location.href;
  if (currentUrl.includes('cyber-guard-ai-seven.vercel.app') || currentUrl.includes('localhost:5173')) return;

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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    .cyberguard-overlay { font-family: 'Inter', -apple-system, sans-serif; position: fixed; bottom: 24px; right: 24px; z-index: 2147483647; display: flex; flex-direction: column; align-items: flex-end; gap: 16px; }
    
    .shield { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.3); transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); user-select: none; border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
    .shield:hover { transform: scale(1.08) translateY(-4px); }
    .shield.safe { background: linear-gradient(135deg, rgba(16,185,129,0.9), rgba(5,150,105,0.9)); box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4); }
    .shield.warn { background: linear-gradient(135deg, rgba(245,158,11,0.9), rgba(217,119,6,0.9)); animation: pulse-amber 2s infinite; }
    .shield.danger { background: linear-gradient(135deg, rgba(239,68,68,0.9), rgba(185,28,28,0.9)); animation: pulse-red 1s infinite; }
    .shield.unknown { background: linear-gradient(135deg, rgba(75,85,99,0.9), rgba(55,65,81,0.9)); }
    
    @keyframes pulse-amber { 0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); } 50% { box-shadow: 0 0 0 12px rgba(245, 158, 11, 0); } }
    @keyframes pulse-red { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); } 50% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); } }
    
    .panel { width: 320px; background: rgba(17, 24, 39, 0.75); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 20px; padding: 24px; color: #f3f4f6; box-shadow: 0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1); margin-bottom: 0px; opacity: 0; transform: translateY(20px) scale(0.95); animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; transform-origin: bottom right; }
    
    @keyframes slideUp { to { opacity: 1; transform: translateY(0) scale(1); } }
    
    .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 14px; }
    .panel-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 10px; letter-spacing: 0.3px; color: #f9fafb; }
    .close-btn { background: rgba(255,255,255,0.06); border: none; color: #9ca3af; cursor: pointer; font-size: 18px; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
    .close-btn:hover { background: rgba(255,255,255,0.15); color: #fff; transform: rotate(90deg); }
    
    .status-container { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .status-text { font-size: 13px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .verdict-badge { padding: 6px 16px; border-radius: 9999px; font-size: 13px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.15); }
    .verdict-badge.safe { background: rgba(16, 185, 129, 0.2); color: #34d399; text-shadow: 0 0 10px rgba(52, 211, 153, 0.4); }
    .verdict-badge.warn { background: rgba(245, 158, 11, 0.2); color: #fbbf24; text-shadow: 0 0 10px rgba(251, 191, 36, 0.4); }
    .verdict-badge.danger { background: rgba(239, 68, 68, 0.2); color: #f87171; text-shadow: 0 0 10px rgba(248, 113, 113, 0.4); }
    .verdict-badge.unknown { background: rgba(107, 114, 128, 0.2); color: #d1d5db; }
    
    .stats-card { background: rgba(0,0,0,0.25); border-radius: 16px; padding: 18px 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 24px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); }
    .stat-item { text-align: center; display: flex; flex-direction: column; gap: 6px; }
    .stat-number { font-size: 26px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; }
    .stat-label { font-size: 10px; color: #9ca3af; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
    .stat-item.red .stat-number { color: #f87171; text-shadow: 0 0 16px rgba(248, 113, 113, 0.5); }
    .stat-item.amber .stat-number { color: #fbbf24; text-shadow: 0 0 16px rgba(251, 191, 36, 0.5); }
    .stat-item.green .stat-number { color: #34d399; text-shadow: 0 0 16px rgba(52, 211, 153, 0.5); }
    
    .dashboard-link { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 14px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border-radius: 14px; text-decoration: none; font-size: 15px; font-weight: 600; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4), inset 0 1px 0 rgba(255,255,255,0.2); box-sizing: border-box; }
    .dashboard-link:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(37, 99, 235, 0.6), inset 0 1px 0 rgba(255,255,255,0.3); background: linear-gradient(135deg, #60a5fa, #2563eb); }
    .dashboard-link svg { width: 18px; height: 18px; transition: transform 0.3s; }
    .dashboard-link:hover svg { transform: translateX(4px); }
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
            <span class="panel-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #60a5fa; drop-shadow(0 0 8px rgba(96,165,250,0.5))"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              CyberGuard AI
            </span>
            <button class="close-btn" id="close-panel" title="Close">\u00D7</button>
          </div>
          
          <div class="status-container">
            <span class="status-text">Status</span>
            <span class="verdict-badge ${sc}">${currentState.verdict.toUpperCase() || 'SCANNING...'}</span>
          </div>
          
          <div class="stats-card">
            <div class="stat-item green"><div class="stat-number">${currentState.safe}</div><div class="stat-label">Safe</div></div>
            <div class="stat-item amber"><div class="stat-number">${currentState.suspicious}</div><div class="stat-label">Suspicious</div></div>
            <div class="stat-item red"><div class="stat-number">${currentState.malicious}</div><div class="stat-label">Malicious</div></div>
          </div>
          
          <a href="#" class="dashboard-link" id="open-dashboard">
            Open Dashboard
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
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
