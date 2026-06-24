document.addEventListener('DOMContentLoaded', async () => {
  // Stats
  const stored = await chrome.storage.local.get(['urlsScanned', 'threatsFound', 'sessionId']);
  document.getElementById('urls-scanned').textContent = stored.urlsScanned || 0;
  document.getElementById('threats-found').textContent = stored.threatsFound || 0;

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
    });
  });

  // Dashboard
  document.getElementById('open-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://cyber-guard-ai-seven.vercel.app' });
  });

  // Get current page links
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' });
      if (resp && resp.results) updateLinkList(resp.results);
    } catch (e) {}
  }

  function updateLinkList(data) {
    const linkList = document.getElementById('link-list');
    const pageStatus = document.getElementById('page-status');

    if (!data || Object.keys(data).length === 0) {
      pageStatus.textContent = 'No scan results for this page.';
      return;
    }

    const entries = Object.entries(data);
    let malicious = 0;
    const links = entries.map(([url, result]) => {
      const color = result.verdict === 'malicious' ? '#ef4444' : result.verdict === 'suspicious' ? '#f59e0b' : '#22c55e';
      if (result.verdict === 'malicious') malicious++;
      return `<div class="link-item"><span class="link-dot" style="background:${color}"></span><span class="link-url" title="${url}">${url.substring(0, 45)}${url.length > 45 ? '...' : ''}</span><span class="link-score">${result.riskScore}</span></div>`;
    });

    linkList.innerHTML = links.join('') || '<p class="empty-state">No links found.</p>';
    pageStatus.textContent = `${entries.length} links scanned. ${malicious} malicious.`;
    document.getElementById('urls-scanned').textContent = entries.length;
    document.getElementById('threats-found').textContent = malicious;
  }
});
