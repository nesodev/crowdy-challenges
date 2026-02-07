(function () {
    const LOG_VERSION = "3.0.0";
    console.error(`[FALABELLA] SCRAPER LOADED - Version ${LOG_VERSION}`);

    setTimeout(() => {
        const port = chrome.runtime.connect({ name: 'content' });

        port.onMessage.addListener(async (msg) => {
            if (msg.type === 'start') {
                console.error(`[FALABELLA] START RECV (Remaining: ${msg.remainingItems}) [v${LOG_VERSION}]`);
                try {
                    const hydrated = await waitForHydration();
                    console.log(`hydration: ${hydrated ? 'ok' : 'timeout'}`);
                    await scrapeFalabella(port, msg.remainingItems || 100);
                } catch (e) {
                    port.postMessage({ type: 'error', error: e.message });
                }
            }
        });
    }, 1000);

    async function scrapeFalabella(port, target) {
        let allItems = [];
        const startTime = Date.now();
        const MAX_TIME = 60000;
        let lastCount = 0;
        let stagnated = 0;
        let scrollCount = 0;

        while (Date.now() - startTime < MAX_TIME) {
            scrollCount++;
            const container = document.getElementById('testId-searchResults-products') || document.body;
            const containerStatus = container !== document.body ? "OK" : "ERROR (body)";

            const pods = container.querySelectorAll('[data-pod="catalyst-pod"], .pod');
            const podsStatus = pods.length > 0 ? "OK" : "ERROR (empty)";

            console.error(`[FALABELLA] SCROLL ${scrollCount}: Contenedor [${containerStatus}], Pods [${podsStatus}] -> ${pods.length} items`);

            if (pods.length === 0) {
                stagnated++;
                window.scrollBy(0, 1000);
                await new Promise(r => setTimeout(r, 2000));
                if (stagnated > 10) break;
                continue;
            }

            const discovered = Array.from(pods).map(el => {
                try {
                    const brand = el.querySelector('.pod-title')?.innerText || "";
                    const name = el.querySelector('.pod-subTitle')?.innerText || "";
                    const title = (brand + " " + name).trim();
                    const url = el.querySelector('a')?.href || el.href;

                    const priceEl = el.querySelector('.pod-prices span[class*="copy10"]');
                    const price = priceEl?.innerText || "0";

                    const sellerText = el.querySelector('.pod-sellerText')?.innerText || "";
                    const sellerClean = sellerText.replace(/Por\s+/i, '').trim() || "Falabella";

                    if (!title || !url) return null;
                    return { title, price, url, seller: sellerClean, isOfficial: sellerClean.toLowerCase().includes('falabella') };
                } catch (e) { return null; }
            }).filter(Boolean);

            const urls = new Set(allItems.map(p => p.url));
            const fresh = discovered.filter(p => !urls.has(p.url));

            if (fresh.length > 0) {
                allItems.push(...fresh);
                port.postMessage({ type: 'result', products: fresh, finished: false });
                stagnated = 0;
                lastCount = allItems.length;
            } else {
                stagnated++;
            }

            if (allItems.length >= target) break;

            if (allItems.length >= target) break;

            if (stagnated > 6) {
                const nextBtn = document.querySelector('#testId-pagination-bottom-arrow-right, button[id*="pagination-bottom-next"], .pagination-button--next');

                if (nextBtn) {
                    const isDisabled = nextBtn.disabled || nextBtn.getAttribute('aria-disabled') === 'true';
                    console.error(`[FALABELLA] PAGINATION CHECK: Found button, Disabled: ${isDisabled}`);

                    if (!isDisabled) {
                        console.log(`nav: next page`);
                        nextBtn.scrollIntoView({ block: 'center' });
                        await new Promise(r => setTimeout(r, 500));
                        nextBtn.click();
                        stagnated = 0;
                        await waitForHydration();
                        continue;
                    }
                }
                console.log(`pagination: done`);
                break;
            }

            window.scrollBy(0, 1500);
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log(`scrape done: ${allItems.length}`);
        port.postMessage({ type: 'result', products: [], finished: true });
    }

    async function waitForHydration(timeoutMs = 8000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const grid = document.getElementById('testId-searchResults-products');
            const pod = document.querySelector('[class*="pod-skeleton"], .pod-skeleton');
            const hasProducts = grid && grid.querySelector('[id^="testId-pod-"]');

            if (hasProducts && !pod) return true;
            if (hasProducts && Date.now() - start > 3000) return true;

            await new Promise(r => setTimeout(r, 500));
        }
        return false;
    }
})();
