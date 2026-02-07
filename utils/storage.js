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

        // Update Stats & Gamification
        const stats = await storage.getStats();
        stats.itemsSaved = (stats.itemsSaved || 0) + 1;

        // Calculate Points: 10 base + 1 per dollar
        const pointsEarned = 10 + Math.floor(amount);
        stats.totalPoints = (stats.totalPoints || 0) + pointsEarned;

        // Update Streak
        const lastSaveDate = stats.lastSaveDate ? new Date(stats.lastSaveDate) : null;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (lastSaveDate) {
            const lastDate = new Date(lastSaveDate.getFullYear(), lastSaveDate.getMonth(), lastSaveDate.getDate());
            const diffTime = Math.abs(today - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                stats.currentStreak = (stats.currentStreak || 0) + 1;
            } else if (diffDays > 1) {
                stats.currentStreak = 1; // Reset if missed a day
            }
            // If diffDays === 0 (same day), do nothing to streak
        } else {
            stats.currentStreak = 1; // First save ever
        }
        stats.lastSaveDate = now.toISOString();

        // Check Achievements
        const unlocked = await storage.checkAchievements(stats);

        await storage.set({ stats });

        return { pointsEarned, newStreak: stats.currentStreak, unlocked };
    },
    getTotalSaved: async () => {
        const data = await storage.get(['totalSaved']);
        return data.totalSaved || 0;
    },
    getStats: async () => {
        const data = await storage.get(['stats']);
        return data.stats || { currentStreak: 0, totalPoints: 0, itemsSaved: 0, lastSaveDate: null, achievements: [] };
    },
    checkAchievements: async (stats) => {
        const newUnlocks = [];
        const current = stats.achievements || [];

        // Define Achievements
        const goals = [
            { id: 'first_save', name: 'First Steps', desc: 'Saved your first item', condition: (s) => s.itemsSaved >= 1 },
            { id: 'streak_3', name: 'On Fire', desc: '3 Day Streak', condition: (s) => s.currentStreak >= 3 },
            { id: 'streak_7', name: 'Unstoppable', desc: '7 Day Streak', condition: (s) => s.currentStreak >= 7 },
            { id: 'saver_100', name: 'Big Saver', desc: 'Earned 100 Points', condition: (s) => s.totalPoints >= 100 },
            { id: 'saver_1000', name: 'Vault Keeper', desc: 'Earned 1000 Points', condition: (s) => s.totalPoints >= 1000 }
        ];

        goals.forEach(goal => {
            if (!current.includes(goal.id) && goal.condition(stats)) {
                newUnlocks.push(goal);
                current.push(goal.id);
            }
        });

        stats.achievements = current;
        return newUnlocks;
    }
};
