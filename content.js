/**
 * eBay Total Price Extension - content.js
 */

const DEFAULT_TAX_RATE = 0.0925; // 9.25% Santa Clara default

let currentTaxRate = DEFAULT_TAX_RATE;

// Load settings
chrome.storage.sync.get(['taxRate'], (result) => {
    if (result.taxRate !== undefined) {
        currentTaxRate = result.taxRate / 100;
    }
    processAllItems();
});

// Update when settings change
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.taxRate) {
        currentTaxRate = changes.taxRate.newValue / 100;
        // Reprocess everything if tax rate changes
        document.querySelectorAll('.s-card').forEach(item => {
            item.removeAttribute('data-ebay-total-processed');
            const placeholder = item.querySelector('.ebay-total-price-container');
            if (placeholder) placeholder.remove();
        });
        processAllItems();
    }
});

function parsePrice(text) {
    if (!text) return 0;
    const match = text.match(/\$([0-9,.]+)/);
    if (!match) return 0;
    return parseFloat(match[1].replace(/,/g, ''));
}

function parseShipping(item) {
    // Look for shipping info in attribute rows
    const rows = item.querySelectorAll('.s-card__attribute-row span');
    for (const row of rows) {
        const text = row.textContent.toLowerCase();
        if (text.includes('delivery') || text.includes('shipping')) {
            if (text.includes('free')) return 0;
            const price = parsePrice(text);
            return price;
        }
    }
    return 0; // Default to 0 if not found
}

function processItem(item) {
    if (item.hasAttribute('data-ebay-total-processed')) return;

    const priceElement = item.querySelector('.s-card__price');
    if (!priceElement) return;

    const basePrice = parsePrice(priceElement.textContent);
    const shipping = parseShipping(item);

    // Formula: (Price * (1 + TaxRate)) + Shipping
    const tax = basePrice * currentTaxRate;
    const total = basePrice + tax + shipping;

    const container = document.createElement('div');
    container.className = 'ebay-total-price-container';

    const label = document.createElement('span');
    label.className = 'ebay-total-price-label';
    label.textContent = 'Total:';

    const value = document.createElement('span');
    value.className = 'ebay-total-price-value';
    value.textContent = `$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const disclaimer = document.createElement('span');
    disclaimer.className = 'ebay-total-price-disclaimer';
    disclaimer.textContent = `(incl. est. tax $${tax.toFixed(2)})`;

    container.appendChild(label);
    container.appendChild(value);
    container.appendChild(disclaimer);

    // Insert after the price row
    const priceRow = priceElement.closest('.s-card__attribute-row');
    if (priceRow) {
        priceRow.insertAdjacentElement('afterend', container);
    }

    item.setAttribute('data-ebay-total-processed', 'true');
}

function processAllItems() {
    const items = document.querySelectorAll('.s-card');
    items.forEach(processItem);
}

// Watch for dynamic updates
const observer = new MutationObserver((mutations) => {
    processAllItems();
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial call
processAllItems();
