document.addEventListener('DOMContentLoaded', async () => {
  // Restore stored session statistics
  const stored = await chrome.storage.local.get(['urlsScanned', 'threatsFound', 'whitelistedDomains', 'shieldSettings']);
  document.getElementById('urls-scanned').textContent = stored.urlsScanned || 0;
  document.getElementById('threats-found').textContent = stored.threatsFound || 0;

  const whitelisted = new Set(stored.whitelistedDomains || []);
  const settings = stored.shieldSettings || { linkShield: true, formGuard: true, networkShield: true };

  // Set toggle state
  document.getElementById('toggle-link-shield').checked = settings.linkShield;
  document.getElementById('toggle-form-guard').checked = settings.formGuard;
  document.getElementById('toggle-network-shield').checked = settings.networkShield;

  // Toggle listeners
  ['toggle-link-shield', 'toggle-form-guard', 'toggle-network-shield'].forEach(id => {
    document.getElementById(id).addEventListener('change', async () => {
      const updated = {
        linkShield: document.getElementById('toggle-link-shield').checked,
        formGuard: document.getElementById('toggle-form-guard').checked,
        networkShield: document.getElementById('toggle-network-shield').checked,
      };
      await chrome.storage.local.set({ shieldSettings: updated });
    });
  });

  // Navigation Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
    });
  });

  // Dashboard Button
  document.getElementById('open-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://cyber-guard-ai-seven.vercel.app/dashboard' });
  });

  // Query Active Tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    let currentDomain = '';
    try {
      currentDomain = new URL(tab.url).hostname;
    } catch (e) {
      currentDomain = tab.url;
    }
    document.getElementById('page-domain').textContent = currentDomain || 'Active Tab';

    // Whitelist status button
    const whitelistBtn = document.getElementById('whitelist-btn');
    if (whitelisted.has(currentDomain)) {
      whitelistBtn.classList.add('active');
    }

    whitelistBtn.addEventListener('click', async () => {
      if (whitelisted.has(currentDomain)) {
        whitelisted.delete(currentDomain);
        whitelistBtn.classList.remove('active');
      } else {
        whitelisted.add(currentDomain);
        whitelistBtn.classList.add('active');
      }
      await chrome.storage.local.set({ whitelistedDomains: [...whitelisted] });
    });

    // Request active page scan info from content script
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' });
      if (resp && resp.results) {
        updatePageScanUI(resp.results, currentDomain);
      }
    } catch (e) {
      updateGauge(5, 'Safe Domain', '#10b981');
    }
  }

  function updateGauge(riskScore, verdictLabel, color) {
    const gaugeFill = document.getElementById('gauge-fill');
    const pageScore = document.getElementById('page-score');
    const pageVerdict = document.getElementById('page-verdict');

    pageScore.textContent = Math.round(riskScore);
    pageVerdict.textContent = verdictLabel;
    pageVerdict.style.color = color;

    // SVG dasharray offset computation (circle circumference = 100)
    gaugeFill.style.strokeDasharray = `${riskScore}, 100`;
    gaugeFill.style.stroke = color;
  }

  function updatePageScanUI(results, domain) {
    const linkList = document.getElementById('link-list');
    const entries = Object.entries(results);

    if (!entries || entries.length === 0) {
      updateGauge(0, 'Page Protected', '#10b981');
      linkList.innerHTML = '<p class="empty-state">No suspicious links detected on page.</p>';
      return;
    }

    let maliciousCount = 0;
    let maxRisk = 0;

    const htmlItems = entries.map(([url, res]) => {
      const score = Math.round(res.riskScore || 0);
      if (score > maxRisk) maxRisk = score;

      let color = '#10b981';
      let badgeBg = 'rgba(16, 185, 129, 0.15)';
      if (res.verdict === 'malicious') {
        maliciousCount++;
        color = '#ef4444';
        badgeBg = 'rgba(239, 68, 68, 0.15)';
      } else if (res.verdict === 'suspicious') {
        color = '#f59e0b';
        badgeBg = 'rgba(245, 158, 11, 0.15)';
      }

      return `<div class="link-item">
        <span class="link-dot" style="background:${color}"></span>
        <span class="link-url" title="${url}">${url}</span>
        <span class="link-score-badge" style="background:${badgeBg}; color:${color}">${score}</span>
      </div>`;
    });

    linkList.innerHTML = htmlItems.join('');

    let verdictLabel = 'Domain Secure';
    let gaugeColor = '#10b981';
    if (maliciousCount > 0) {
      verdictLabel = `${maliciousCount} Threat(s) Found`;
      gaugeColor = '#ef4444';
    } else if (maxRisk > 40) {
      verdictLabel = 'Suspicious Elements';
      gaugeColor = '#f59e0b';
    }

    updateGauge(maxRisk || (maliciousCount > 0 ? 85 : 5), verdictLabel, gaugeColor);
    document.getElementById('urls-scanned').textContent = entries.length;
    document.getElementById('threats-found').textContent = maliciousCount;
  }

  // ─── Account Authentication & Sync Handler ─────────────────
  const authLoggedOut = document.getElementById('auth-logged-out');
  const authLoggedIn = document.getElementById('auth-logged-in');
  const userEmailDisplay = document.getElementById('user-email-display');
  const authError = document.getElementById('auth-error');
  const loginForm = document.getElementById('popup-login-form');
  const logoutBtn = document.getElementById('logout-btn');

  const authData = await chrome.storage.local.get(['userToken', 'userEmail']);
  if (authData.userToken && authData.userEmail) {
    showLoggedIn(authData.userEmail);
  } else {
    showLoggedOut();
  }

  function showLoggedIn(email) {
    if (authLoggedOut) authLoggedOut.style.display = 'none';
    if (authLoggedIn) authLoggedIn.style.display = 'block';
    if (userEmailDisplay) userEmailDisplay.textContent = email;
  }

  function showLoggedOut() {
    if (authLoggedOut) authLoggedOut.style.display = 'block';
    if (authLoggedIn) authLoggedIn.style.display = 'none';
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authError.textContent = '';
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value.trim();
      const loginBtn = document.getElementById('login-btn');

      if (!email || !password) return;

      loginBtn.disabled = true;
      loginBtn.textContent = 'Authenticating...';

      try {
        const apiUrl = await chrome.storage.sync.get(['apiUrl']).then(res => res.apiUrl || 'https://cyberguardai-naip.onrender.com');
        const res = await fetch(`${apiUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const json = await res.json();
        if (res.ok && json.success && json.data) {
          const token = json.data.accessToken;
          const userEmail = json.data.user?.email || email;
          await chrome.storage.local.set({ userToken: token, userEmail });
          showLoggedIn(userEmail);
          loginForm.reset();
        } else {
          authError.textContent = json.error?.message || 'Login failed. Check credentials.';
        }
      } catch (err) {
        authError.textContent = 'Connection error. Check backend server.';
      } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Log In & Sync Account';
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await chrome.storage.local.remove(['userToken', 'userEmail']);
      showLoggedOut();
    });
  }
});

