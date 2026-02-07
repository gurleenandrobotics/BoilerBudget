export const storage = {
    get: (keys) => {
        return new Promise((resolve) => {
            chrome.storage.local.get(keys, (result) => {
                resolve(result);
            });
        });
    },
    set: (items) => {
        return new Promise((resolve) => {
            chrome.storage.local.set(items, () => {
                resolve();
            });
        });
    },
    // Specific helpers
    getSettings: async () => {
        const defaultSettings = {
            monthlyAllowance: 200, // Default $200
            currency: '$'
        };
        const saved = await storage.get(['settings']);
        return { ...defaultSettings, ...saved.settings };
    },
    saveSettings: async (settings) => {
        await storage.set({ settings });
    },
    addToWishlist: async (item) => {
        // limit wishlist size?
        const data = await storage.get(['wishlist']);
        const list = data.wishlist || [];
        list.push({ ...item, date: new Date().toISOString() });
        await storage.set({ wishlist: list });
    },
    getWishlist: async () => {
        const data = await storage.get(['wishlist']);
        return data.wishlist || [];
    },
    addSavings: async (amount) => {
        const data = await storage.get(['totalSaved']);
        const current = data.totalSaved || 0;
        await storage.set({ totalSaved: current + amount });
    },
    getTotalSaved: async () => {
        const data = await storage.get(['totalSaved']);
        return data.totalSaved || 0;
    }
};
