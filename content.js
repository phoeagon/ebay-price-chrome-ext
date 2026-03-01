/**
 * eBay Total Price Extension - content.js
 */

const DEFAULT_TAX_RATE = 0.0925; // 9.25% Santa Clara default

let currentTaxRate = DEFAULT_TAX_RATE;
let greyOutOriginal = true;
let originalOrder = [];

// Load settings
chrome.storage.sync.get(['taxRate', 'greyOutPrice'], (result) => {
    if (result.taxRate !== undefined) {
        currentTaxRate = result.taxRate / 100;
    }
    if (result.greyOutPrice !== undefined) {
        greyOutOriginal = result.greyOutPrice;
    }
    processAllItems();
    injectBanner();
});

// Update when settings change
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
        if (changes.taxRate) currentTaxRate = changes.taxRate.newValue / 100;
        if (changes.greyOutPrice) greyOutOriginal = changes.greyOutPrice.newValue;

        // Reprocess everything if settings change
        document.querySelectorAll('.s-card').forEach(item => {
            item.removeAttribute('data-ebay-total-processed');
            const placeholder = item.querySelector('.ebay-total-price-container');
            if (placeholder) placeholder.remove();

            const originalPrice = item.querySelector('.s-card__price');
            if (originalPrice) originalPrice.classList.remove('ebay-total-price-greyed');
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
    const attributeRows = item.querySelectorAll('.s-card__attribute-row');
    for (const row of attributeRows) {
        const text = row.textContent.toLowerCase();
        // Check if this row contains shipping/delivery keywords
        if (text.includes('delivery') || text.includes('shipping') || text.includes('postage')) {
            if (text.includes('free')) return 0;

            // Extract the numerical price from the entire row text
            // This handles cases where the price and keyword are in separate spans
            return parsePrice(text);
        }
    }

    // Fallback for some eBay versions that use different classes
    const logistics = item.querySelector('.s-item__logisticsCost');
    if (logistics) {
        const text = logistics.textContent.toLowerCase();
        if (text.includes('free')) return 0;
        return parsePrice(text);
    }

    return 0;
}

function processItem(item) {
    if (item.hasAttribute('data-ebay-total-processed')) return;

    const priceElement = item.querySelector('.s-card__price');
    if (!priceElement) return;

    const basePrice = parsePrice(priceElement.textContent);
    const shipping = parseShipping(item);

    const tax = basePrice * currentTaxRate;
    const total = basePrice + tax + shipping;

    item.setAttribute('data-total-price', total);

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

    if (greyOutOriginal) {
        priceElement.classList.add('ebay-total-price-greyed');
    }

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

function injectBanner() {
    if (document.getElementById('ebay-total-price-banner-id')) return;

    const target = document.querySelector('.srp-controls');
    if (!target) return;

    const banner = document.createElement('div');
    banner.id = 'ebay-total-price-banner-id';
    banner.className = 'ebay-total-price-banner';

    banner.innerHTML = `
        <span><b>eBay Total Price Extension</b> active</span>
        <div class="ebay-total-price-banner-controls">
            <button class="ebay-total-price-btn" id="sort-total-btn">Sort by Total Price</button>
            <button class="ebay-total-price-btn secondary" id="reset-sort-btn">Reset Order</button>
        </div>
    `;

    target.prepend(banner);

    document.getElementById('sort-total-btn').addEventListener('click', sortByTotal);
    document.getElementById('reset-sort-btn').addEventListener('click', resetSort);
}

function sortByTotal() {
    const container = document.querySelector('.srp-river-main > .s-clipped')?.parentElement || document.querySelector('.srp-results');
    if (!container) return;

    // Capture original order if not already captured
    const itemNodes = Array.from(document.querySelectorAll('.s-card'));
    if (originalOrder.length === 0) {
        originalOrder = itemNodes.map(node => ({ node, parent: node.parentElement, next: node.nextSibling }));
    }

    const sorted = itemNodes.sort((a, b) => {
        const valA = parseFloat(a.getAttribute('data-total-price')) || 0;
        const valB = parseFloat(b.getAttribute('data-total-price')) || 0;
        return valA - valB;
    });

    sorted.forEach(node => {
        // We only move the LI elements inside the results list to keep it clean
        let toMove = node;
        if (node.tagName !== 'LI') {
            const liParent = node.closest('li');
            if (liParent && (liParent.parentElement.classList.contains('srp-results') || liParent.parentElement.classList.contains('srp-river-results'))) {
                toMove = liParent;
            }
        }

        if (toMove.parentElement) {
            toMove.parentElement.appendChild(toMove);
        }
    });
}

function resetSort() {
    if (originalOrder.length === 0) return;

    originalOrder.forEach(item => {
        let toMove = item.node;
        if (item.node.tagName !== 'LI' && item.node.parentElement.tagName === 'LI') {
            toMove = item.node.parentElement;
        }
        item.parent.insertBefore(toMove, item.next);
    });
}

// Watch for dynamic updates
const observer = new MutationObserver((mutations) => {
    processAllItems();
    injectBanner();
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial call
processAllItems();
injectBanner();
