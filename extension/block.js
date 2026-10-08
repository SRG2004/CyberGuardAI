document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const blockedUrl = params.get('url') || 'Unknown URL';
  
  try {
    const urlObj = new URL(blockedUrl);
    document.getElementById('blocked-domain').textContent = urlObj.hostname;
  } catch (e) {
    document.getElementById('blocked-domain').textContent = 'this site';
  }

  document.getElementById('blocked-url').textContent = decodeURIComponent(blockedUrl);

  // Extract score from search params if available
  const score = params.get('score') || '--';
  document.getElementById('risk-score').textContent = score === '--' ? 'HIGH' : `${score}/100`;

  document.getElementById('risk-reasons').innerHTML = `
    <div class="reason"><span class="reason-icon">⚠️</span><span class="reason-text">Flagged as malicious by CyberGuard Deep XAI analysis.</span></div>
    <div class="reason"><span class="reason-icon">⛔</span><span class="reason-text">This site is known to attempt to steal user credentials or install malware.</span></div>
  `;

  // Go back
  document.getElementById('go-back').addEventListener('click', () => {
    window.history.back();
    // Fallback if history is empty
    setTimeout(() => {
      window.close();
    }, 500);
  });

  // Toggle details
  document.getElementById('toggle-details').addEventListener('click', () => {
    const details = document.getElementById('details-content');
    if (details.classList.contains('hidden')) {
      details.classList.remove('hidden');
    } else {
      details.classList.add('hidden');
    }
  });

  // Proceed with countdown
  let proceedClicks = 0;
  document.getElementById('proceed').addEventListener('click', () => {
    if (proceedClicks === 0) {
      proceedClicks = 1;
      document.getElementById('countdown').textContent = 'Please wait 5 seconds before proceeding...';
      let count = 5;
      const interval = setInterval(() => {
        count--;
        document.getElementById('countdown').textContent = `Proceeding in ${count} seconds...`;
        if (count <= 0) {
          clearInterval(interval);
          document.getElementById('countdown').textContent = '';
          document.getElementById('proceed').textContent = 'Proceed (Unsafe)';
          document.getElementById('proceed').addEventListener('click', () => {
            window.location.href = decodeURIComponent(blockedUrl);
          }, { once: true });
        }
      }, 1000);
    }
  });
});
