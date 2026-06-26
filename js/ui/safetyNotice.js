// One-time safety notice, shown on first launch.
//
// Slackwater presents tide predictions and weather that people use to plan
// activities with real physical risk (boating, wading, fishing, paddling), so
// we surface the "verify before you rely" message once, up front and in
// context — not only buried in the Terms of Use. Acknowledgement is remembered
// locally; bump ACK_KEY's version suffix to re-show after a material change.

const ACK_KEY = 'sw_safety_ack_v1';
const TERMS_URL = 'https://workingmodel.cc/slackwater-terms.html';

export function maybeShowSafetyNotice() {
  let acked = false;
  try { acked = localStorage.getItem(ACK_KEY) === '1'; } catch (_) { /* storage blocked — show it */ }
  if (acked) return;

  const overlay = document.createElement('div');
  overlay.className = 'safety-overlay';
  overlay.innerHTML = `
    <div class="safety-card" role="dialog" aria-modal="true" aria-labelledby="safety-title">
      <div class="safety-icon"><i class="ph-fill ph-warning"></i></div>
      <h2 id="safety-title">Before you rely on Slackwater</h2>
      <p>Slackwater shows tide <strong>predictions</strong> and weather for the Texas coast, for general information and recreation. Data can be delayed, estimated, or wrong, and real conditions can differ.</p>
      <p><strong>Don't use it as your only source for navigation or safety.</strong> For boating, wading, fishing, or any on-the-water decision, also check official NOAA tide tables, NWS marine forecasts, and the U.S. Coast Guard.</p>
      <button class="btn btn-primary btn-block" id="safety-ack"><i class="ph-bold ph-check"></i> I understand</button>
      <a class="safety-terms" href="${TERMS_URL}" target="_blank" rel="noopener">Read the full Terms of Use</a>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  const dismiss = () => {
    try { localStorage.setItem(ACK_KEY, '1'); } catch (_) { /* best effort */ }
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 250);
  };
  overlay.querySelector('#safety-ack').addEventListener('click', dismiss);
}
