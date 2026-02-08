import { getQuestionsForPrice } from './utils/questions.js';
import { budgetStorage } from './utils/budget_storage.js';

chrome.runtime.onInstalled.addListener(() => {
    console.log('BoilerBudget installed.');
    // Initialize default storage if needed
    chrome.storage.local.get(['settings', 'totalSaved'], (result) => {
        if (!result.settings) {
            chrome.storage.local.set({
                settings: { monthlyAllowance: 200, currency: '$' }
            });
        }
        if (!result.totalSaved) {
            chrome.storage.local.set({ totalSaved: 0 });
        }
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('BoilerBudget: Background received message:', request.type, request);

    if (request.type === 'GET_QUESTIONS') {
        try {
            const questions = getQuestionsForPrice(request.price);
            console.log('BoilerBudget: Sending questions:', questions.length);
            sendResponse({ questions });
        } catch (err) {
            console.error('BoilerBudget: Error in GET_QUESTIONS:', err);
            sendResponse({ questions: [] });
        }
    }
    else if (request.type === 'ADD_SAVINGS') {
        budgetStorage.addSavings(request.amount).then((result) => {
            console.log('BoilerBudget: Savings added result:', result);
            sendResponse(result);
        }).catch(err => {
            console.error('BoilerBudget: Error in ADD_SAVINGS:', err);
        });
        return true; // Keep channel open
    }
    else if (request.type === 'GET_TTS') {
        const text = request.text || '';
        console.log('[BoilerBudget Background] TTS request for:', text.substring(0, 50));

        (async () => {
            try {
                // Check if TTS is enabled
                const storageData = await new Promise((resolve) => {
                    chrome.storage.local.get(['ttsEnabled'], resolve);
                });
                
                console.log('[BoilerBudget Background] TTS enabled:', storageData.ttsEnabled);
                
                if (!storageData.ttsEnabled) {
                    console.warn('[BoilerBudget Background] TTS is disabled');
                    sendResponse({ ok: false, error: 'TTS disabled' });
                    return;
                }

                console.log('[BoilerBudget Background] Calling backend TTS endpoint...');
                // Call backend TTS endpoint
                const response = await fetch('http://127.0.0.1:8000/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text })
                });

                console.log('[BoilerBudget Background] Backend response status:', response.status);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.warn('[BoilerBudget Background] Backend TTS error:', response.status, errorText);
                    sendResponse({ ok: false, error: 'Failed to generate audio' });
                    return;
                }

                const data = await response.json();
                console.log('[BoilerBudget Background] Backend returned data with audio:', !!data.audio);
                
                if (data.audio) {
                    console.log('[BoilerBudget Background] Sending audioUrl to content script');
                    sendResponse({ ok: true, audioUrl: data.audio });
                } else {
                    console.warn('[BoilerBudget Background] No audio data in response');
                    sendResponse({ ok: false, error: 'No audio data returned' });
                }
            } catch (err) {
                console.error('[BoilerBudget Background] TTS error:', err.message, err);
                sendResponse({ ok: false, error: String(err.message) });
            }
        })();

        return true; // keep message channel open for async response
    }
    else if (request.type === 'ADD_TO_WISHLIST') {
        const item = request.item;
        console.log('[BoilerBudget Background] ADD_TO_WISHLIST request:', item);

        budgetStorage.addToWishlist(item).then(() => {
            console.log('[BoilerBudget Background] Item added to wishlist');
            sendResponse({ ok: true });
        }).catch((err) => {
            console.error('[BoilerBudget Background] Wishlist add error:', err);
            sendResponse({ ok: false, error: String(err) });
        });

        return true; // keep message channel open for async response
    }
    // Keep the channel open for async response
    return true;
});
