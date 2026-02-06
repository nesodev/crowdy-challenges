export function normalizeProduct(site, keyword, rawData, position) {
    return {
        id: rawData.id || `${site}-${Date.now()}-${position}`,
        site,
        keyword,
        timestamp: Date.now(),
        position,
        title: rawData.title || null,
        priceVisible: formatVisiblePrice(rawData.price),
        priceNumeric: parsePrice(rawData.price),
        url: rawData.url || null,
        seller: rawData.seller || site,
        isOfficial: !!rawData.isOfficial,
        stars: parseFloat(rawData.stars) || 0,
        reviews: parseInt(rawData.reviews, 10) || 0,
        brand: rawData.brand || null
    };
}

function formatVisiblePrice(str) {
    if (!str) return 'S/ 0';
    if (str.startsWith('S/')) return str;
    const num = parsePrice(str);
    return `S/ ${num.toLocaleString('es-PE')}`;
}

function parsePrice(str) {
    if (!str) return 0;

    let s = str.toString().replace(/[S\/\s]/g, '');


    if (s.includes(',') && s.indexOf(',') >= s.length - 3) {
        s = s.split(',')[0];
    }
    if (s.includes('.') && s.indexOf('.') >= s.length - 3) {
        s = s.split('.')[0];
    }

    const digits = s.replace(/[^\d]/g, '');
    return parseInt(digits, 10) || 0;
}
