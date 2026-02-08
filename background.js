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
    // Keep the channel open for async response
    return true;
});
