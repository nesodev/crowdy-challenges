(function () {
    const LOG_VERSION = "3.0.0";
    console.error(`[ML] SCRAPER LOADED - Version ${LOG_VERSION}`);

    const port = chrome.runtime.connect({ name: 'content' });

    port.onMessage.addListener(async (msg) => {
        if (msg.type === 'start') {
            console.error(`[ML] START RECV (Remaining: ${msg.remainingItems}) [v${LOG_VERSION}]`);
            try {
                await new Promise(r => setTimeout(r, 2000));
                const target = msg.remainingItems || 100;
                if (target <= 0) {
                    port.postMessage({ type: 'result', products: [], finished: true });
                    return;
                }
                await scrapeML(target);
            } catch (e) {
                port.postMessage({ type: 'error', error: e.message });
            }
        }
    });

    async function scrapeML(targetCount) {
        let accumulatedInTab = 0;
        let pageCount = 0;
        const startTime = Date.now();
        const MAX_EXEC_TIME = 60000;

        while (accumulatedInTab < targetCount) {
            pageCount++;
            if (Date.now() - startTime > MAX_EXEC_TIME) {
                console.log(`page ${pageCount} err`);
                break;
            }

            await new Promise(r => setTimeout(r, 2000));

            const results = document.querySelectorAll('li.ui-search-layout__item, .ui-search-result, .poly-card');
            const containerStatus = results.length > 0 ? "OK" : "ERROR (empty)";

            let newProducts = Array.from(results).map(el => extractProduct(el)).filter(Boolean);

            const needed = targetCount - accumulatedInTab;
            if (newProducts.length > needed) {
                newProducts = newProducts.slice(0, needed);
            }

            const productsStatus = newProducts.length > 0 ? "OK" : "ERROR (extraction failed)";
            console.error(`[ML] PAGINA ${pageCount}: Contenedor [${containerStatus}], Productos [${productsStatus}] -> ${newProducts.length} items (Needed: ${needed})`);

            accumulatedInTab += newProducts.length;

            const isDone = accumulatedInTab >= targetCount;
            port.postMessage({ type: 'result', products: newProducts, finished: isDone });

            if (isDone) break;

            const nextBtn = document.querySelector('.andes-pagination__button--next a, [title="Siguiente"]');
            if (nextBtn && nextBtn.href && !nextBtn.classList.contains('andes-pagination__button--disabled')) {
                console.log(`nav: next ${nextBtn.href}`);
                window.location.href = nextBtn.href;
                break;
            } else {
                console.log(`nav: no more pages`);
                port.postMessage({ type: 'result', products: [], finished: true });
                break;
            }
        }
        return [];
    }

    function extractProduct(el) {
        try {
            const titleEl = el.querySelector('.poly-component__title, .ui-search-item__title, h2, [class*="title"]');
            const url = titleEl?.closest('a')?.href || el.querySelector('a')?.href;
            if (!titleEl || !url) {
                return null;
            }

            const allPrices = Array.from(el.querySelectorAll('.andes-money-amount'));
            const realPriceEl = allPrices.find(p => {
                if (p.closest('.andes-money-amount--previous') || p.closest('[class*="price-old"]')) return false;
                if (p.closest('.poly-phrase-price') || p.closest('[class*="installments"]')) return false;
                return true;
            });

            const fraction = realPriceEl?.querySelector('.andes-money-amount__fraction')?.textContent || "0";
            const cleanPrice = fraction.replace(/\./g, '');

            const sellerEl = el.querySelector('.ui-search-official-store-label, .poly-component__seller, .ui-search-item__group__element--description, .poly-component__seller-container');
            const sellerName = sellerEl?.textContent?.trim() || 'Vendedor ML';

            return {
                title: titleEl.textContent.trim(),
                price: cleanPrice,
                url: url,
                seller: sellerName,
                isOfficial: !!el.querySelector('.ui-search-official-store-label'),
                stars: el.querySelector('.ui-search-reviews__rating-number')?.textContent || 0,
                reviews: el.querySelector('.ui-search-reviews__amount')?.textContent || 0
            };
        } catch (e) {
            return null;
        }
    }

    function mergeUnique(existing, discovered) {
        const urls = new Set(existing.map(p => p.url));
        const filtered = discovered.filter(p => !urls.has(p.url));
        return [...existing, ...filtered];
    }
})();
