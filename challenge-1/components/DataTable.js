export function renderStoreTable(storeData) {
    return `
        <div class="table-wrapper">
            <div class="table-title">Comparativa</div>
            <table>
                <thead>
                    <tr>
                        <th>Tienda</th>
                        <th>Resultados</th>
                        <th>Min</th>
                        <th>Max</th>
                        <th>Prom</th>
                        <th>Media</th>
                    </tr>
                </thead>
                <tbody>
                    ${storeData.map(d => {
        const icon = d.store === 'mercadolibre' ? 'ml.png' : 'falabella.png';
        const s = d.stats;
        return `
                        <tr>
                            <td>
                                <div class="site-cell">
                                    <img src="assets/markets/${icon}" alt="${d.store}" class="table-icon">
                                    <span>${d.store === 'mercadolibre' ? 'ML' : 'Falabella'}</span>
                                </div>
                            </td>
                            <td>${d.count}</td>
                            <td><a href="${s.minUrl}" target="_blank" class="price-link">S/ ${s.min}</a></td>
                            <td><a href="${s.maxUrl}" target="_blank" class="price-link">S/ ${s.max}</a></td>
                            <td>S/ ${s.avg}</td>
                            <td>S/ ${s.median}</td>
                        </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

export function renderVariationsTable(clusters) {
    return `
        <div class="table-wrapper">
            <div class="table-title">Variaciones</div>
            <table>
                <thead>
                    <tr>
                        <th>Variacion</th>
                        <th>Tiendas</th>
                        <th>Cant.</th>
                        <th>Min</th>
                        <th>Max</th>
                        <th>Prom</th>
                    </tr>
                </thead>
                <tbody>
                    ${clusters.map(c => {
        const s = c.stats;
        const icons = c.stores.map(st =>
            `<img src="assets/markets/${st === 'mercadolibre' ? 'ml.png' : 'falabella.png'}" class="mini-inline-icon">`
        ).join('');
        return `
                        <tr>
                            <td class="col-title" title="${c.name}">${c.name}</td>
                            <td><div class="stores-cell">${icons}</div></td>
                            <td>${c.products.length}</td>
                            <td><a href="${s.minUrl}" target="_blank" class="price-link bold">S/ ${s.min}</a></td>
                            <td><a href="${s.maxUrl}" target="_blank" class="price-link">S/ ${s.max}</a></td>
                            <td>S/ ${s.avg}</td>
                        </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

export function renderRecommendationsTable(recommendations) {
    return `
        <div class="table-wrapper">
            <div class="table-title">Recomendaciones</div>
            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Tienda</th>
                        <th>Precio</th>
                        <th>Proveedor</th>
                        <th>Calificacion</th>
                        <th>Por que?</th>
                    </tr>
                </thead>
                <tbody>
                    ${recommendations.map(p => {
        const icon = p.site === 'mercadolibre' ? 'ml.png' : 'falabella.png';
        const reason = p.reasonObj || { type: 'standard', text: 'Opcion Confiable' };
        return `
                        <tr>
                            <td class="col-title">
                                <a href="${p.url}" target="_blank" class="product-link">${p.title.substring(0, 30)}...</a>
                            </td>
                            <td><img src="assets/markets/${icon}" class="table-icon"></td>
                            <td><a href="${p.url}" target="_blank" class="price-link strong">S/ ${p.priceNumeric}</a></td>
                            <td class="seller-cell">
                                ${p.seller}
                                ${p.seller.toLowerCase().includes('oficial') || p.seller.toLowerCase().includes('gold') ? ' <span class="badge">ok</span>' : ''}
                            </td>
                            <td class="score-cell">${p.stars || '-'}</td>
                            <td class="reason-cell">
                                <span class="tag tag-${reason.type}">${reason.text}</span>
                            </td>
                        </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}
