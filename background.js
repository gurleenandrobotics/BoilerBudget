import { getQuestionsForPrice } from './utils/questions.js';

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
    if (request.type === 'GET_QUESTIONS') {
        const questions = getQuestionsForPrice(request.price);
        sendResponse({ questions });
    }
    // Keep the channel open for async response
    return true;
});
