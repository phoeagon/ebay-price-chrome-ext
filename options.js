function saveOptions() {
    const zipCode = document.getElementById('zipCode').value;
    const taxRate = document.getElementById('taxRate').value;
    const greyOutPrice = document.getElementById('greyOutPrice').checked;

    chrome.storage.sync.set({
        zipCode: zipCode || '95050',
        taxRate: parseFloat(taxRate) || 9.25,
        greyOutPrice: greyOutPrice
    }, () => {
        const status = document.getElementById('status');
        status.textContent = 'Settings saved.';
        setTimeout(() => {
            status.textContent = '';
        }, 2000);
    });
}

function restoreOptions() {
    chrome.storage.sync.get({
        zipCode: '95050',
        taxRate: 9.25,
        greyOutPrice: true
    }, (items) => {
        document.getElementById('zipCode').value = items.zipCode;
        document.getElementById('taxRate').value = items.taxRate;
        document.getElementById('greyOutPrice').checked = items.greyOutPrice;
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
