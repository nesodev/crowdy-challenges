
export function clusterProducts(products) {
    const clusters = [];
    const threshold = 0.6;

    products.forEach(p => {
        let bestMatch = -1;
        let maxSim = 0;

        for (let i = 0; i < clusters.length; i++) {
            const sim = calculateSpecSimilarity(p.title, clusters[i][0].title);
            if (sim > maxSim) {
                maxSim = sim;
                bestMatch = i;
            }
        }

        if (maxSim >= threshold && bestMatch !== -1) {
            clusters[bestMatch].push(p);
        } else {
            clusters.push([p]);
        }
    });

    return clusters.map(group => {
        const stats = calculateAdvancedStats(group);
        const stores = [...new Set(group.map(p => p.site))];

        return {
            name: generateClusterName(group),
            products: group,
            stores: stores,
            stats: stats
        };
    }).sort((a, b) => b.products.length - a.products.length);
}

export function calculateStoreStats(products) {
    const stores = ['mercadolibre', 'falabella'];
    return stores.map(store => {
        const storeProducts = products.filter(p => p.site === store);
        if (storeProducts.length === 0) return null;

        return {
            store: store,
            count: storeProducts.length,
            stats: calculateAdvancedStats(storeProducts)
        };
    }).filter(Boolean);
}

export function calculateAdvancedStats(products) {
    if (!products || products.length === 0) return null;

    // Filter valid prices and sort
    const validProducts = products
        .filter(p => p.priceNumeric > 0)
        .sort((a, b) => a.priceNumeric - b.priceNumeric);

    if (validProducts.length === 0) return null;

    const count = validProducts.length;
    const prices = validProducts.map(p => p.priceNumeric);
    const sum = prices.reduce((a, b) => a + b, 0);

    const minProd = validProducts[0];
    const maxProd = validProducts[count - 1];

    const avg = Math.round(sum / count);
    const median = count % 2 === 0
        ? (prices[count / 2 - 1] + prices[count / 2]) / 2
        : prices[Math.floor(count / 2)];

    return {
        count,
        min: minProd.priceNumeric,
        minUrl: minProd.url,
        max: maxProd.priceNumeric,
        maxUrl: maxProd.url,
        avg,
        median
    };
}

export function generateRecommendations(products) {
    if (!products.length) return [];

    const clusters = clusterProducts(products);
    const recommendations = [];

    clusters.forEach(cluster => {
        const stats = cluster.stats;
        if (!stats) return;

        cluster.products.forEach(p => {
            let score = 0;
            const tags = [];

            if (p.priceNumeric <= stats.min * 1.02) {
                score += 40;
                tags.push({ type: 'price', text: 'Mejor Precio' });
            } else if (p.priceNumeric <= stats.avg * 0.9) {
                score += 25;
                tags.push({ type: 'offer', text: 'Oferta Destacada' });
            }

            const sellerLower = p.seller.toLowerCase();
            const isOfficial = sellerLower.includes('oficial') || sellerLower.includes('falabella');
            const isReputable = sellerLower.includes('gold') || sellerLower.includes('lider') || sellerLower.includes('platinum');

            if (isOfficial) {
                score += 35;
                tags.push({ type: 'official', text: 'Tienda Oficial' });
            } else if (isReputable) {
                score += 25;
                tags.push({ type: 'seller', text: 'Top Vendedor' });
            }

            if (p.stars >= 4.7 && p.reviews > 20) {
                score += 25;
                tags.push({ type: 'rating', text: 'Favorito del Publico' });
            } else if (p.stars >= 4.2) {
                score += 15;
                tags.push({ type: 'trust', text: 'Alta Calificacion' });
            }

            let finalReason = { type: 'standard', text: 'Opcion Confiable' };
            if (isOfficial) finalReason = tags.find(t => t.type === 'official');
            else if (p.priceNumeric <= stats.min * 1.02) finalReason = tags.find(t => t.type === 'price');
            else if (isReputable) finalReason = tags.find(t => t.type === 'seller');
            else if (tags.length > 0) finalReason = tags[0];

            recommendations.push({
                ...p,
                biScore: score,
                reasonObj: finalReason
            });
        });
    });

    return recommendations
        .sort((a, b) => b.biScore - a.biScore || a.priceNumeric - b.priceNumeric)
        .slice(0, 10);
}

function calculateSpecSimilarity(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    const specs = /\d+\s*(gb|tb|mb|ram|hz|v|pulgadas|'|")|pro|max|ultra|plus|air|mini|lite/g;
    const specs1 = s1.match(specs) || [];
    const specs2 = s2.match(specs) || [];
    if (specs1.length > 0 && specs2.length > 0) {
        if (specs1.some(x => !specs2.includes(x))) return 0;
    }
    const t1 = new Set(s1.split(/\s+/));
    const t2 = new Set(s2.split(/\s+/));
    const intersection = new Set([...t1].filter(x => t2.has(x)));
    return intersection.size / new Set([...t1, ...t2]).size;
}

function generateClusterName(group) {
    const allTitles = group.map(p => p.title.toLowerCase().split(/\s+/));
    const common = allTitles[0].filter(token => allTitles.every(t => t.includes(token)) && token.length > 2);
    const blacklist = ['de', 'el', 'la', 'con', 'para', 'precio', 'oferta'];
    return common.filter(t => !blacklist.includes(t))
        .map(t => t.charAt(0).toUpperCase() + t.slice(1))
        .join(' ') || "Modelo Base";
}
