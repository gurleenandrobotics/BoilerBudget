// Pattern to detect checkout or cart URLs
const CHECKOUT_REGEX = /checkout|cart|basket|buy/i;

// ============================================================
// GLOBAL VARIABLES - Declare all before use
// ============================================================
let questions = [];
let questionIndex = 0;
let score = 0;
let shadow = null; // Shadow root reference
window.bbCurrentPrice = 0; // Global tracker
let audioEnabled = true; // Toggle TTS on/off
let currentAudio = null; // HTMLAudioElement for playback
let currentItemInfo = {}; // Store current item info for wishlist

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

function startIntervention(price) {
    window.bbCurrentPrice = price;
    
    // Capture item information for wishlist
    currentItemInfo = {
        title: document.title.split('|')[0].trim(),
        price: price,
        url: window.location.href,
        date: new Date().toISOString()
    };
    
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

/**
 * Request TTS audio from background and play it
 */
function playQuestionAudio(questionText) {
    console.log('[BoilerBudget Content] playQuestionAudio called. audioEnabled:', audioEnabled);
    
    if (!audioEnabled) {
        console.log('[BoilerBudget Content] Audio disabled, skipping TTS');
        return;
    }

    console.log('[BoilerBudget Content] Requesting TTS for:', questionText.substring(0, 50));
    chrome.runtime.sendMessage({ type: 'GET_TTS', text: questionText }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('[BoilerBudget Content] Message error:', chrome.runtime.lastError.message);
            return;
        }
        
        console.log('[BoilerBudget Content] TTS response received:', response);
        
        if (response && response.ok && response.audioUrl) {
            console.log('[BoilerBudget Content] Audio URL received, attempting playback');
            
            try {
                // Stop any currently playing audio
                if (currentAudio) {
                    currentAudio.pause();
                    currentAudio = null;
                }

                // Convert data URL to Blob and create object URL
                const audioData = response.audioUrl;
                let audioBlob;
                
                if (audioData.startsWith('data:')) {
                    // Parse data URL
                    const parts = audioData.split(',');
                    const mimeString = parts[0].match(/:(.*?);/)[1];
                    const bstr = atob(parts[1]);
                    const n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    for (let i = 0; i < n; i++) {
                        u8arr[i] = bstr.charCodeAt(i);
                    }
                    audioBlob = new Blob([u8arr], { type: mimeString });
                } else {
                    console.error('[BoilerBudget Content] Unexpected audio URL format');
                    return;
                }

                const blobUrl = URL.createObjectURL(audioBlob);
                console.log('[BoilerBudget Content] Created blob URL for audio');
                
                // Create and play new audio
                currentAudio = new Audio();
                currentAudio.src = blobUrl;
                currentAudio.onplay = () => console.log('[BoilerBudget Content] Audio playing');
                currentAudio.onerror = (e) => {
                    console.error('[BoilerBudget Content] Audio error event:', e);
                    console.error('[BoilerBudget Content] Audio error details:', currentAudio.error);
                };
                currentAudio.onended = () => {
                    console.log('[BoilerBudget Content] Audio ended');
                    URL.revokeObjectURL(blobUrl);
                };
                
                const playPromise = currentAudio.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => console.log('[BoilerBudget Content] Audio playback started'))
                        .catch((err) => {
                            console.error('[BoilerBudget Content] Audio play promise rejected:', err.name, err.message);
                        });
                }
            } catch (err) {
                console.error('[BoilerBudget Content] Exception in playQuestionAudio:', err);
            }
        } else {
            console.warn('[BoilerBudget Content] TTS failed:', response?.error || 'Unknown error', 'Response:', response);
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
    
    // Use global price if not provided
    if (!price) {
        price = window.bbCurrentPrice || 0;
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
         <div style="display: flex; justify-content: space-between; align-items: center;">
           <h2>Pause for a Moment</h2>
           <button id="bb-speaker" class="bb-speaker-btn" title="Toggle audio">🔊</button>
         </div>
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

    // Play audio if enabled
    const questionText = questions[questionIndex].text.replace('{price}', '$' + (price || 0).toFixed(2));
    playQuestionAudio(questionText);

    // Attach speaker button listener
    const speakerBtn = shadow.querySelector('#bb-speaker');
    if (speakerBtn) {
        speakerBtn.onclick = (e) => {
            e.stopPropagation();
            audioEnabled = !audioEnabled;
            speakerBtn.textContent = audioEnabled ? '🔊' : '🔇';
            speakerBtn.style.opacity = audioEnabled ? '1' : '0.5';
            if (audioEnabled) {
                playQuestionAudio(questionText);
            }
        };
    }

    // Attach listeners
    if (!q.inputType || q.inputType === 'buttons') {
        const btnYes = shadow.querySelector('#btn-yes');
        const btnMeh = shadow.querySelector('#btn-meh');
        const btnNo = shadow.querySelector('#btn-no');

        if (btnYes) btnYes.onclick = () => answer(1);
        if (btnMeh) btnMeh.onclick = () => answer(0);
        if (btnNo) btnNo.onclick = () => answer(-1);
    } else {
        // Handle Next Button for inputs
        const nextBtn = shadow.querySelector('#btn-next');

        if (q.inputType === 'scale') {
            const range = shadow.querySelector('#bb-input-scale');
            const disp = shadow.querySelector('#bb-scale-val');
            if (range && disp) {
                range.oninput = (e) => disp.textContent = e.target.value;
            }
            if (nextBtn) nextBtn.onclick = () => answer(parseInt(range.value));
        }
        else if (q.inputType === 'number') {
            const input = shadow.querySelector('#bb-input-number');
            if (nextBtn) nextBtn.onclick = () => {
                const val = parseFloat(input.value);
                if (isNaN(val)) return; // Validate
                answer(val);
            };
        }
        else if (q.inputType === 'text') {
            const input = shadow.querySelector('#bb-input-text');
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

    shadow.querySelector('#btn-save').onclick = async () => {
        const savedAmount = window.bbCurrentPrice || 0;

        // Stop audio playback
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }

        // Log item to wishlist
        if (currentItemInfo && currentItemInfo.title && currentItemInfo.price > 0) {
            chrome.runtime.sendMessage({ type: 'ADD_TO_WISHLIST', item: currentItemInfo }, (response) => {
                if (response && response.ok) {
                    console.log('[BoilerBudget] Item logged');
                }
            });
        }

        chrome.runtime.sendMessage({ type: 'ADD_SAVINGS', amount: savedAmount }, (response) => {
            if (response) {
                const { pointsEarned, newStreak, unlocked } = response;
                alert(`🎉 SAVED! \n\n+${pointsEarned} Points 🪙\nStreak: ${newStreak} 🔥`);
                document.getElementById('boiler-budget-host').remove();
            }
        });
    };

    shadow.querySelector('#btn-buy').onclick = () => {
        // Stop audio playback
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        document.getElementById('boiler-budget-host').remove();
    };
}
