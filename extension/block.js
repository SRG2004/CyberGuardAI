document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const blockedUrl = params.get('url') || 'Unknown URL';

  document.getElementById('blocked-url').textContent = decodeURIComponent(blockedUrl);

  // Extract score from search params if available
  const score = params.get('score') || '--';
  document.getElementById('risk-score').textContent = score === '--' ? 'HIGH' : `${score}/100`;

  document.getElementById('risk-reasons').innerHTML = `
    <div class="reason"><span class="reason-icon">\uD83D\uDD34</span><span class="reason-text">Flagged as potentially malicious by AI analysis</span></div>
    <div class="reason"><span class="reason-icon">\u26A0\uFE0F</span><span class="reason-text">This site may attempt to steal personal information</span></div>
    <div class="reason"><span class="reason-icon">\uD83D\uDEAB</span><span class="reason-text">Navigate back or close this tab immediately</span></div>
  `;

  // Go back
  document.getElementById('go-back').addEventListener('click', () => {
    window.history.back();
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
          document.getElementById('proceed').disabled = false;
          document.getElementById('proceed').textContent = 'Proceed Anyway';
          document.getElementById('proceed').addEventListener('click', () => {
            window.location.href = decodeURIComponent(blockedUrl);
          }, { once: true });
        }
      }, 1000);
    }
  });
});
