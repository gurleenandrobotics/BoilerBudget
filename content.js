// Pattern to detect checkout or cart URLs
const CHECKOUT_REGEX = /checkout|cart|basket|buy/i;

// Heuristic to find price on the page
function findPrice() {
    // Look for common price patterns like $12.34
    // This is a naive implementation for the hackathon
    // 1. Try Meta Tags first (Reliable)
    const metaPrice = document.querySelector('meta[property="og:price:amount"]');
    if (metaPrice) return parseFloat(metaPrice.content);

    const schemaPrice = document.querySelector('meta[itemprop="price"]');
    if (schemaPrice) return parseFloat(schemaPrice.content);

    // 2. Regex fallback
    const text = document.body.innerText;
    const priceMatch = text.match(/\$[0-9]+(\.[0-9]{2})?/); // Basic regex
    if (priceMatch) {
        return parseFloat(priceMatch[0].replace('$', ''));
    }
    return 0; // Fallback
}

function shouldIntervene() {
    return CHECKOUT_REGEX.test(window.location.href);
}

// ----------------------------------------------------------------------
// MAIN LOGIC
// ----------------------------------------------------------------------

if (shouldIntervene()) {
    const price = findPrice();
    if (price > 0) {
        // Check if we already intervened continuously? 
        // For demo, just run it.
        console.log('BoilerBudget: Intervening! Price detected:', price);
        startIntervention(price);
    }
}

// ----------------------------------------------------------------------
// INTERVENTION UI
// ----------------------------------------------------------------------

let questions = [];
let questionIndex = 0;
let score = 0;
let shadow = null; // Shadow root reference

function startIntervention(price) {
    // 1. Get Questions from background
    chrome.runtime.sendMessage({ type: 'GET_QUESTIONS', price }, (response) => {
        questions = response.questions;
        if (questions && questions.length > 0) {
            showOverlay(price);
        }
    });
}

function showOverlay(price) {
    const host = document.createElement('div');
    host.id = 'boiler-budget-host';
    host.style.position = 'fixed';
    host.style.top = '0';
    host.style.left = '0';
    host.style.width = '100%';
    host.style.height = '100%';
    host.style.zIndex = '2147483647'; // Max Z-Index

    document.body.appendChild(host);
    shadow = host.attachShadow({ mode: 'open' });

    // Add styles
    const link = document.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', chrome.runtime.getURL('styles.css'));
    shadow.appendChild(link);

    // Create Container
    const container = document.createElement('div');
    container.className = 'bb-overlay';
    shadow.appendChild(container);

    renderQuestion(price, container);
}

function renderQuestion(price, container) {
    if (!container) {
        container = shadow.querySelector('.bb-overlay');
    }

    // End of questions? Show Result
    if (questionIndex >= questions.length) {
        renderResult(container);
        return;
    }

    const q = questions[questionIndex];

    let inputHtml = '';

    // Default Buttons (Yes/Meh/No)
    if (!q.inputType || q.inputType === 'buttons') {
        inputHtml = `
      <div class="bb-actions">
         <button id="btn-yes" class="bb-btn bb-btn-primary">Yes</button>
         <button id="btn-meh" class="bb-btn bb-btn-secondary">Neutral</button>
         <button id="btn-no" class="bb-btn bb-btn-danger">No</button>
      </div>`;
    }
    // Number Input (e.g. Hours)
    else if (q.inputType === 'number') {
        inputHtml = `
      <div style="margin-top: 15px; display: flex; flex-direction: column; align-items: center; gap: 15px;">
         <input type="number" id="bb-input-number" class="allowance-input" placeholder="${q.unit || 'Enter amount'}" style="text-align: center; width: 150px; color: #fff; background: rgba(255,255,255,0.1); border: 1px solid rgba(212,175,55,0.3);">
         <button id="btn-next" class="bb-btn bb-btn-primary">Next</button>
      </div>`;
    }
    // Text Input
    else if (q.inputType === 'text') {
        inputHtml = `
      <div style="margin-top: 15px; display: flex; flex-direction: column; align-items: center; gap: 15px; width: 100%;">
         <textarea id="bb-input-text" class="allowance-input" rows="3" placeholder="${q.placeholder || 'Type here...'}" style="width: 100%; resize: none; color: #fff; background: rgba(255,255,255,0.1); border: 1px solid rgba(212,175,55,0.3);"></textarea>
         <button id="btn-next" class="bb-btn bb-btn-primary">Next</button>
      </div>`;
    }
    // Scale Input (1-10)
    else if (q.inputType === 'scale') {
        inputHtml = `
      <div style="margin-top: 15px; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px;">
         <div style="display: flex; justify-content: space-between; font-size: 12px; color: #eee; width: 100%;">
           <span>1</span><span>10</span>
         </div>
         <input type="range" id="bb-input-scale" min="1" max="10" value="5" style="width: 100%; accent-color: #D4AF37;">
         <div style="text-align: center; font-weight: bold; color: #D4AF37; font-size: 18px;" id="bb-scale-val">5</div>
         <p style="font-size: 12px; color: #ddd; margin: 0;">${q.scaleLabel || ''}</p>
         <button id="btn-next" class="bb-btn bb-btn-primary" style="margin-top: 10px;">Next</button>
      </div>`;
    }

    container.innerHTML = `
    <div class="bb-card">
      <div class="bb-header">
         <h2>Pause for a Moment</h2>
         <p>Let's think about this purchase.</p>
      </div>
      <div class="bb-progress">
        Question ${questionIndex + 1} / ${questions.length}
      </div>
      <div class="bb-question">
        ${questions[questionIndex].text.replace('{price}', '$' + (price || 0).toFixed(2))}
      </div>
      ${inputHtml}
    </div>
  `;

    // Attach listeners
    if (!q.inputType || q.inputType === 'buttons') {
        const btnYes = shadow.getElementById('btn-yes');
        const btnMeh = shadow.getElementById('btn-meh');
        const btnNo = shadow.getElementById('btn-no');

        if (btnYes) btnYes.onclick = () => answer(1);
        if (btnMeh) btnMeh.onclick = () => answer(0);
        if (btnNo) btnNo.onclick = () => answer(-1);
    } else {
        // Handle Next Button for inputs
        const nextBtn = shadow.getElementById('btn-next');

        if (q.inputType === 'scale') {
            const range = shadow.getElementById('bb-input-scale');
            const disp = shadow.getElementById('bb-scale-val');
            if (range && disp) {
                range.oninput = (e) => disp.textContent = e.target.value;
            }
            if (nextBtn) nextBtn.onclick = () => answer(parseInt(range.value));
        }
        else if (q.inputType === 'number') {
            const input = shadow.getElementById('bb-input-number');
            if (nextBtn) nextBtn.onclick = () => {
                const val = parseFloat(input.value);
                if (isNaN(val)) return; // Validate
                answer(val);
            };
        }
        else if (q.inputType === 'text') {
            const input = shadow.getElementById('bb-input-text');
            if (nextBtn) nextBtn.onclick = () => {
                if (input.value.trim().length === 0) return;
                answer(input.value);
            };
        }
    }
}

function answer(val) {
    const q = questions[questionIndex];
    let impact = 0;

    // Handle Buttons
    if (!q.inputType || q.inputType === 'buttons') {
        if (q.type === 'impulse' || q.type === 'emotion' || q.type === 'money') {
            // Yes = bad, No = good
            if (val === 1) impact = -1;
            if (val === -1) impact = 1;
        } else {
            // Need, Future = Yes is good
            if (val === 1) impact = 1;
            if (val === -1) impact = -1;
        }
    }
    // Handle Number (e.g., Hours)
    else if (q.inputType === 'number') {
        // Simple heuristic: > 2 hours work is "expensive" (-1), else (+1)
        if (val > 2) impact = -1;
        else impact = 1;
    }
    // Handle Scale (1-10)
    else if (q.inputType === 'scale') {
        // 1-4: Low (-1), 5-7: Neutral (0), 8-10: High (+1)
        // "Need" -> High is good (+1)
        // "Desire Stability" -> High is good (+1)
        if (val >= 8) impact = 1;
        else if (val <= 4) impact = -1;
    }
    // Handle Text
    else if (q.inputType === 'text') {
        // Just answering is positive reflection
        if (val.length > 5) impact = 1;
    }

    score += impact;
    questionIndex++;
    renderQuestion(null, null); // Pass nulls to rely on scoped vars
}

function renderResult(container) {
    let decision = 'WAIT';
    let message = 'You should probably wait 24 hours.';
    let color = '#D4AF37'; // Gold

    if (score >= 3) {
        decision = 'BUY';
        message = 'You have thought this through. Proceed.';
        color = '#10b981'; // Green
    } else if (score < 0) {
        decision = 'SKIP';
        message = 'This seems like an impulse buy. save your money!';
        color = '#ef4444'; // Red
    }

    container.innerHTML = `
    <div class="bb-card">
      <div class="bb-header">
         <h2>Decision Time</h2>
      </div>
      
      <div style="margin: 20px 0;">
        <div style="font-size: 14px; color: #aaa; text-transform: uppercase; letter-spacing: 1px;">Recommendation</div>
        <div style="font-size: 48px; font-weight: 800; color: ${color}; margin: 10px 0; text-shadow: 0 0 20px ${color}40;">
          ${decision}
        </div>
        <p style="font-size: 16px; color: #fff;">${message}</p>
      </div>

      <div class="bb-actions">
         <button id="btn-save" class="bb-btn bb-btn-primary">Save $ (Skip)</button>
         <button id="btn-buy" class="bb-btn bb-btn-secondary">Buy Anyway</button>
      </div>
    </div>
  `;

    shadow.getElementById('btn-save').onclick = () => {
        // Save logic
        // We don't have the item price easily available here unless tracked globally.
        // For now, save 0 or use the last known price passed to renderQuestion (if we tracked it).
        // Let's just alert for now.
        alert("Great choice! You saved money.");
        document.getElementById('boiler-budget-host').remove();
    };

    shadow.getElementById('btn-buy').onclick = () => {
        document.getElementById('boiler-budget-host').remove();
    };
}
