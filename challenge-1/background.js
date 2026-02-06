import { normalizeProduct } from './utils.js';
const LOG_VERSION = "3.0.0";
console.error(`BACKGROUND: Service Worker Alive - Version ${LOG_VERSION}`);

let searchTracker = {};
let isReady = false;
let storageQueue = Promise.resolve();

const initPromise = chrome.storage.local.get(['searchTracker']).then(res => {
    searchTracker = res.searchTracker || {};
    const now = Date.now();
    for (const id in searchTracker) {
        if (now - parseInt(id) > 900000) delete searchTracker[id];
    }
    isReady = true;
    return chrome.storage.local.set({ searchTracker });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.error("BACKGROUND RECV:", msg.type, msg.id || '');
    initPromise.then(() => {
        handleMessage(msg, sender, sendResponse);
    });
    return true;
});

async function handleMessage(msg, sender, sendResponse) {
    switch (msg.type) {
        case 'start_search':
            startScraping(msg).catch(err => console.error("SCRAPE ERR:", err));
            break;
        case 'cancel':
            cancelScraping(msg.id).catch(err => console.error("CANCEL ERR:", err));
            break;
        case 'get_results':
            sendResults(msg.id).catch(err => console.error("RESULTS ERR:", err));
            break;
    }
}

async function startScraping({ id, site, keyword }) {
    storageQueue = storageQueue.then(async () => {
        console.error(`[QUEUE] Starting scrape for [${site}] - ${keyword} [v${LOG_VERSION}]`);

        if (!searchTracker[id]) {
            searchTracker[id] = { sites: [], tabCounts: {} };
        }
        if (!searchTracker[id].sites.includes(site)) {
            searchTracker[id].sites.push(site);
        }
        await chrome.storage.local.set({ searchTracker });

        const url = site === 'falabella'
            ? `https://www.falabella.com.pe/falabella-pe/search?Ntt=${encodeURIComponent(keyword)}`
            : `https://listado.mercadolibre.com.pe/${encodeURIComponent(keyword)}`;

        const tab = await chrome.tabs.create({ url, active: false });
        console.error(`[QUEUE] Tab ${tab.id} created for ${site}`);

        const res = await chrome.storage.local.get(['activeTabs']);
        const activeTabs = res.activeTabs || {};
        activeTabs[tab.id] = { id, site, keyword };
        await chrome.storage.local.set({ activeTabs });

        await updateKeywordState(id, 'running');
    }).catch(err => console.error(`[QUEUE] startScraping ERR: ${err.message}`));
}


chrome.runtime.onConnect.addListener(port => {
    initPromise.then(() => {
        if (port.name === 'content') {
            const url = port.sender.tab.url || "";
            const site = url.includes('falabella') ? 'falabella' : 'mercadolibre';
            console.error(`BACKGROUND: Connection established from ${site} [Tab ${port.sender.tab.id}]`);
            handleContentScript(port);
        }
    });
});

async function handleContentScript(port) {
    const tabId = port.sender.tab.id;
    port.onMessage.addListener(async (msg) => {
        const res = await chrome.storage.local.get(['activeTabs']);
        const context = (res.activeTabs || {})[tabId];
        if (!context) return;

        if (msg.type === 'progress') {
            if (searchTracker[context.id]) {
                searchTracker[context.id].tabCounts[tabId] = msg.count;

                const sData = await chrome.storage.local.get(['results']);
                const saved = sData.results?.[context.id]?.length || 0;
                const totalRunning = Object.values(searchTracker[context.id].tabCounts).reduce((a, b) => a + b, 0);
                const displayCount = Math.max(saved, totalRunning);
                const activeSites = searchTracker[context.id].sites || [];

                chrome.runtime.sendMessage({
                    type: 'progress',
                    id: context.id,
                    count: displayCount,
                    activeSites
                }).catch(() => { });
            }
        } else if (msg.type === 'result') {
            await finalizeScraping(context, msg.products, tabId, msg.finished);
        }
    });

    storageQueue = storageQueue.then(async () => {
        const res = await chrome.storage.local.get(['activeTabs', 'results']);
        const context = (res.activeTabs || {})[tabId];
        if (context) {
            const results = res.results?.[context.id] || [];
            const siteItems = results.filter(r => r.site === context.site).length;
            const remaining = Math.max(0, 100 - siteItems);

            console.error(`[BACKGROUND] Sending START to ${context.site} (Remaining: ${remaining}) [v${LOG_VERSION}]`);
            port.postMessage({
                type: 'start',
                keyword: context.keyword,
                remainingItems: remaining,
                version: LOG_VERSION
            });
        }
    });
}

async function finalizeScraping(context, products, tabId, isFinished) {
    if (!products || products.length === 0) {
        console.log(`[bg] ${context.site}: No products.`);
        isFinished = true;
    }

    const normalized = products.map((p, i) => normalizeProduct(context.site, context.keyword, p, i));

    storageQueue = storageQueue.then(async () => {
        const res = await chrome.storage.local.get(['keywords', 'results', 'activeTabs', 'searchTracker']);
        let keywords = res.keywords || [];
        let results = res.results || {};
        let activeTabs = res.activeTabs || {};
        let currentSearchTracker = res.searchTracker || {};

        const idx = keywords.findIndex(k => k.id === context.id);
        if (idx === -1) return;

        if (!results[context.id]) results[context.id] = [];

        const existingUrls = new Set(results[context.id].map(r => r.url));
        const newItems = normalized.filter(p => !existingUrls.has(p.url));
        results[context.id] = [...results[context.id], ...newItems];

        keywords[idx].count = results[context.id].length;

        const siteItems = results[context.id].filter(r => r.site === context.site).length;
        const TARGET_PER_SITE = 100;

        const shouldStop = isFinished || siteItems >= TARGET_PER_SITE;

        if (shouldStop) {
            console.error(`[BACKGROUND] ${context.site.toUpperCase()}: Finalizing session (${siteItems} items).`);
            delete activeTabs[tabId];
            if (currentSearchTracker[context.id]) {
                currentSearchTracker[context.id].sites = currentSearchTracker[context.id].sites.filter(s => s !== context.site);
                delete currentSearchTracker[context.id].tabCounts[tabId];

                if (currentSearchTracker[context.id].sites.length === 0) {
                    console.error(`[BACKGROUND] All sites finished for ${context.id}`);
                    keywords[idx].state = 'done';
                    delete currentSearchTracker[context.id];
                }
            } else {
                keywords[idx].state = 'done';
            }
            chrome.tabs.remove(tabId).catch(() => { });
        } else {
            if (currentSearchTracker[context.id]) {
                currentSearchTracker[context.id].tabCounts[tabId] = siteItems;
            }
        }

        await chrome.storage.local.set({ keywords, results, activeTabs, searchTracker: currentSearchTracker });
        searchTracker = currentSearchTracker;

        chrome.runtime.sendMessage({ type: 'results_data', id: context.id, data: results[context.id] }).catch(() => { });

        const activeSites = searchTracker[context.id]?.sites || [];
        chrome.runtime.sendMessage({
            type: 'progress',
            id: context.id,
            count: keywords[idx].count,
            activeSites
        }).catch(() => { });
    }).catch(err => console.error(`[QUEUE] finalizeScraping ERR: ${err.message}`));
}

async function cancelScraping(id) {
    const res = await chrome.storage.local.get(['activeTabs']);
    const activeTabs = res.activeTabs || {};
    for (const [tid, ctx] of Object.entries(activeTabs)) {
        if (ctx.id === id) {
            chrome.tabs.remove(parseInt(tid)).catch(() => { });
            delete activeTabs[tid];
        }
    }
    delete searchTracker[id];
    await chrome.storage.local.set({ activeTabs, searchTracker: {} });
    await updateKeywordState(id, 'cancelled');
}

async function sendResults(id) {
    const res = await chrome.storage.local.get(['results']);
    chrome.runtime.sendMessage({ type: 'results_data', id, data: res.results?.[id] || [] }).catch(() => { });
}

async function updateKeywordState(id, state) {
    const res = await chrome.storage.local.get(['keywords']);
    let keywords = res.keywords || [];
    const idx = keywords.findIndex(k => k.id === id);
    if (idx !== -1) {
        keywords[idx].state = state;
        await chrome.storage.local.set({ keywords });
    }
}
