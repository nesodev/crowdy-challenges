import { renderEmptyState } from './components/EmptyState.js';
import { renderKeywordList } from './components/KeywordList.js';

let state = {
    keywords: [],
    selectedId: null,
    resultsByKeyword: {},
    selectedStores: ['falabella', 'mercadolibre']
};

chrome.storage.local.get(['keywords', 'selectedStores'], res => {
    state.keywords = res.keywords || [];
    state.selectedStores = res.selectedStores || ['falabella', 'mercadolibre'];
    updateUI();
    updateStoreCheckboxes();
});

chrome.storage.onChanged.addListener(changes => {
    if (changes.keywords) {
        state.keywords = changes.keywords.newValue || [];
        updateUI();
    }
});

document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id || btn.closest('[data-id]')?.dataset.id;
    const site = btn.dataset.site;

    if (action === 'close') {
        window.close();
        return;
    }

    if (id) {
        handleAction(action, id, site);
    }
});

function handleAction(action, id, site) {
    switch (action) {
        case 'close':
            window.close();
            break;
        case 'remove':
            state.keywords = state.keywords.filter(k => k.id !== id);
            chrome.storage.local.set({ keywords: state.keywords });
            updateUI();
            break;
        case 'toggle-expand':
            state.selectedId = state.selectedId === id ? null : id;
            if (state.selectedId && !state.resultsByKeyword[id]) {
                chrome.runtime.sendMessage({ type: 'get_results', id });
            }
            updateUI();
            break;
        case 'download':
            const results = state.resultsByKeyword[id];
            if (results && results.length > 0) {
                downloadJSON(results, `crowdy_results_${id}.json`);
            } else {
                chrome.runtime.sendMessage({ type: 'get_results', id }, (res) => {
                });
            }
            break;
        case 'cancel':
            chrome.runtime.sendMessage({ type: 'cancel', id });
            break;
    }
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

const input = document.getElementById('kw');

document.addEventListener('click', (e) => {
    const isAdd = e.target.closest('.header-controls .input img') ||
        e.target.closest('.header-controls .input');

    if (e.target.tagName === 'IMG' && e.target.closest('.input')) {
        console.error("POPUP: Add button clicked via delegation");
        handleAdd();
    }
});

if (input) {
    input.onkeypress = (e) => {
        if (e.key === 'Enter') {
            console.error("POPUP: Enter pressed");
            handleAdd();
        }
    };
}

function handleAdd() {
    console.error("POPUP: handleAdd called");
    const text = input.value.trim();
    if (!text) return;

    const id = Date.now().toString();
    const newK = { id, text, state: 'running', count: 0, activeSites: [...state.selectedStores] };

    state.keywords.unshift(newK);
    input.value = '';

    chrome.storage.local.set({ keywords: state.keywords });

    state.selectedStores.forEach(site => {
        triggerSearch(id, site, text);
    });
}

function triggerSearch(id, site, keyword) {
    chrome.runtime.sendMessage({
        type: 'start_search',
        id,
        site,
        keyword
    });
}

function updateUI() {
    const bottom = document.querySelector('.footer .bottom');
    const countText = document.querySelector('.footer .top p');
    if (countText) countText.textContent = `Búsquedas (${state.keywords.length})`;
    if (!bottom) return;

    if (state.keywords.length === 0) {
        bottom.classList.remove('has-items');
        bottom.innerHTML = renderEmptyState();
    } else {
        bottom.classList.add('has-items');
        bottom.innerHTML = renderKeywordList(state.keywords, state.selectedId, state.resultsByKeyword);
    }
}

chrome.runtime.onMessage.addListener(msg => {
    if (msg.type === 'results_data') {
        state.resultsByKeyword[msg.id] = msg.data;
        updateUI();
    }
    if (msg.type === 'progress') {
        const kw = state.keywords.find(k => k.id === msg.id);
        if (kw) {
            kw.count = msg.count;
            kw.activeSites = msg.activeSites || [];
            updateUI();
        }
    }
});

const filterBtn = document.getElementById('filter-btn');
const storeSelector = document.getElementById('store-selector');

if (filterBtn && storeSelector) {
    filterBtn.onclick = (e) => {
        e.stopPropagation();
        storeSelector.classList.toggle('hidden');
    };

    storeSelector.onclick = (e) => e.stopPropagation();

    document.addEventListener('click', () => {
        storeSelector.classList.add('hidden');
    });

    storeSelector.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.onchange = () => {
            const stores = [];
            storeSelector.querySelectorAll('input[type="checkbox"]:checked').forEach(checkedCb => {
                stores.push(checkedCb.dataset.store);
            });
            state.selectedStores = stores;
            chrome.storage.local.set({ selectedStores: state.selectedStores });
        };
    });
}

function updateStoreCheckboxes() {
    if (!storeSelector) return;
    storeSelector.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = state.selectedStores.includes(cb.dataset.store);
    });
}
