import { storage } from './utils/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Load initial data
    const totalSaved = await storage.getTotalSaved();
    const settings = await storage.getSettings();
    const wishlist = await storage.getWishlist();

    // Update DOM
    document.getElementById('total-saved').textContent = formatCurrency(totalSaved);

    const allowanceInput = document.getElementById('allowance');
    allowanceInput.value = settings.monthlyAllowance;

    // Listen for allowance changes
    allowanceInput.addEventListener('change', async (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
            await storage.saveSettings({ ...settings, monthlyAllowance: val });
        }
    });

    renderWishlist(wishlist);
});

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}

function renderWishlist(items) {
    const container = document.getElementById('wishlist-list');
    const countEl = document.getElementById('wishlist-count');

    countEl.textContent = items.length;

    if (items.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #9ca3af; padding: 20px;">No items skipped yet.</div>';
        return;
    }

    container.innerHTML = '';
    // Show most recent first
    items.slice().reverse().forEach(item => {
        const el = document.createElement('div');
        el.className = 'wishlist-item';

        // Fallback if title/url missing
        const title = item.title || 'Unknown Item';
        const domain = item.url ? new URL(item.url).hostname.replace('www.', '') : 'Unknown Site';

        el.innerHTML = `
      <div class="wishlist-title" title="${title}">
         <a href="${item.url}" target="_blank" style="text-decoration: none; color: inherit;">${title}</a>
      </div>
      <div class="wishlist-meta">
        <span>${domain}</span>
        <span style="font-weight: 600; color: var(--bb-danger);">${formatCurrency(item.price)}</span>
      </div>
    `;
        container.appendChild(el);
    });
}
