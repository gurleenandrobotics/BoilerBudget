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

console.log('BoilerBudget: Logic loaded. Checking URL:', window.location.href);

if (shouldIntervene()) {
    console.log('BoilerBudget: URL match found. Looking for price...');
    const price = findPrice();
    if (price > 0) {
        console.log('BoilerBudget: Intervening! Price detected:', price);
        startIntervention(price);
    } else {
        console.log('BoilerBudget: No price detected. Skipping intervention.');
    }
} else {
    console.log('BoilerBudget: URL does not match intervention criteria.');
}

// ----------------------------------------------------------------------
// INTERVENTION UI
// ----------------------------------------------------------------------

let questions = [];
let questionIndex = 0;
let score = 0;
let shadow = null; // Shadow root reference
window.bbCurrentPrice = 0; // Global tracker

function startIntervention(price) {
    window.bbCurrentPrice = price;
    console.log('BoilerBudget: Sending GET_QUESTIONS message to background...');
    // 1. Get Questions from background
    chrome.runtime.sendMessage({ type: 'GET_QUESTIONS', price }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('BoilerBudget: Message error:', chrome.runtime.lastError.message);
            return;
        }
        console.log('BoilerBudget: Received response from background:', response);
        questions = response ? response.questions : [];
        if (questions && questions.length > 0) {
            showOverlay(price);
        } else {
            console.warn('BoilerBudget: No questions returned for price:', price);
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
         <input type="number" id="bb-input-number" class="allowance-input" placeholder="${q.unit || 'Enter amount'}" style="text-align: center; width: 150px;">
         <button id="btn-next" class="bb-btn bb-btn-primary">Next</button>
      </div>`;
    }
    // Text Input
    else if (q.inputType === 'text') {
        inputHtml = `
      <div style="margin-top: 15px; display: flex; flex-direction: column; align-items: center; gap: 15px; width: 100%;">
         <textarea id="bb-input-text" class="allowance-input" rows="3" placeholder="${q.placeholder || 'Type here...'}" style="width: 100%; resize: none;"></textarea>
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
    let color = '#FF1493'; // Deep Pink (Dark Pink variant)

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
        <div style="font-size: 14px; color: var(--bb-text-muted); text-transform: uppercase; letter-spacing: 1px;">Recommendation</div>
        <div style="font-size: 48px; font-weight: 800; color: ${color}; margin: 10px 0; text-shadow: 0 0 20px ${color}40;">
          ${decision}
        </div>
        <p style="font-size: 16px; color: var(--bb-text-main);">${message}</p>
      </div>

      <div class="bb-actions">
         <button id="btn-save" class="bb-btn bb-btn-primary">Save $ (Skip)</button>
         <button id="btn-buy" class="bb-btn bb-btn-secondary">Buy Anyway</button>
      </div>

      <div style="margin-top: 20px; border-top: 1px solid rgba(255, 182, 193, 0.3); padding-top: 20px; text-align: center;">
         <a href="http://10.186.26.72:3000/" target="_blank" class="bb-btn bb-btn-primary" style="text-decoration: none; display: inline-block; width: auto; font-size: 13px; padding: 10px 15px; background: #FFB6C1; color: #fff; border-radius: 8px; font-weight: bold;">
            Girl, run your own business: here is a simulator-
         </a>
      </div>
    </div>
  `;

    shadow.getElementById('btn-save').onclick = async () => {
        // Save logic
        // We don't have the item price easily available here unless tracked globally.
        // However, we rely on the implementation of `storage.addSavings`.
        // We need to pass the price or retrieve it. 
        // `renderQuestion` was called with `price`, but we are deep in `renderResult`.
        // Let's rely on a global `currentPrice` variable or similar approach?
        // Actually, `renderQuestion` received `price`, but we didn't persist it. 
        // Let's assume for now we grab it from the DOM text if needed, OR better:
        // We pass `price` through the `renderResult` chain.

        // For now, let's use a heuristic: if `price` variable is available in scope (it is not directly here).
        // Let's fix this by adding `currentPrice` global.
        const savedAmount = window.bbCurrentPrice || 0; // Fallback

        // Call background to add savings (which now handles points/streaks)
        // We need to convert `addSavings` to message passing because content script 
        // cannot access `storage.js` directly if it's an ES module that uses `chrome.storage`?
        // Actually `storage.js` uses `chrome.storage.local` which IS available in content scripts.
        // BUT we imported `getQuestionsForPrice` in background, not `storage` methods?
        // Wait, we need to import `storage` in content.js? 
        // Or send message to background to handle the write.
        // Messaging is safer for logic centralization.

        chrome.runtime.sendMessage({ type: 'ADD_SAVINGS', amount: savedAmount }, (response) => {
            if (response) {
                // Show Feedback
                const { pointsEarned, newStreak, unlocked } = response;
                alert(`🎉 SAVED! \n\n+${pointsEarned} Points 🪙\nStreak: ${newStreak} 🔥`);
                // Removing host
                document.getElementById('boiler-budget-host').remove();
            }
        });
    };

    shadow.getElementById('btn-buy').onclick = () => {
        document.getElementById('boiler-budget-host').remove();
    };
}
