import { renderStoreTable, renderVariationsTable, renderRecommendationsTable } from './DataTable.js';
import { calculateStoreStats, clusterProducts, generateRecommendations } from '../analytics.js';

export function renderKeywordItem(keyword, isExpanded, results) {
    const { id, text, state, count } = keyword;

    const states = {
        'idle': { label: 'Esperando', color: '#9EA3A7' },
        'running': { label: 'Scraping...', color: '#2563eb' },
        'done': { label: 'Listo', color: '#059669' },
        'error': { label: 'Error', color: '#dc2626' },
        'cancelled': { label: 'Cancelado', color: '#6b7280' }
    };

    const currentStatus = states[state] || states.idle;
    const isRunning = state === 'running';
    const activeSites = keyword.activeSites || [];

    let analysisHTML = '';
    if (results && results.length > 0) {
        const storeStats = calculateStoreStats(results);
        const clusters = clusterProducts(results);
        const topRecs = generateRecommendations(results);

        analysisHTML = `
            <div class="analysis-dashboard">
                ${renderStoreTable(storeStats)}
                ${renderVariationsTable(clusters)}
                ${renderRecommendationsTable(topRecs)}
            </div>
        `;
    } else if (isExpanded) {
        analysisHTML = `
            <div class="analysis-loading">
                <div class="spinner"></div>
                <span>${isRunning ? 'Obteniendo datos...' : 'Sin datos disponibles para esta busqueda.'}</span>
            </div>
        `;
    }

    const statusText = isRunning ? `Scraping<span class="dots"></span>` : currentStatus.label;

    return `
        <div class="keyword-container ${isExpanded ? 'active' : ''} state-${state}" data-id="${id}">
            <div class="keyword-header">
                <div class="header-main">
                    <div class="left">
                        <span class="title">${text}</span>
                        <div class="status-row">
                            <span class="status-label" style="color: ${currentStatus.color}">${statusText}</span>
                            <span class="product-count">${count || 0} productos</span>
                        </div>
                    </div>
                    <div class="right">
                        ${isRunning ? `
                            <button class="btn-cancel" data-action="cancel">Cancelar</button>
                        ` : `
                            <img class="action-icon toggle-btn" 
                                 data-action="toggle-expand" 
                                 src="assets/icons/chevron-down.png" alt="expand">
                        `}
                    </div>
                </div>
                
                <div class="header-actions">
                    <div class="search-btns">
                        ${(activeSites.includes('falabella') || (results && results.some(r => r.site === 'falabella'))) ? `
                            <div class="store-icon ${isRunning && activeSites.includes('falabella') ? 'pulsing' : (isRunning && !activeSites.includes('falabella') ? 'finished' : '')}" title="Falabella">
                                <img src="assets/markets/falabella.png" alt="Falabella">
                            </div>
                        ` : ''}
                        ${(activeSites.includes('mercadolibre') || (results && results.some(r => r.site === 'mercadolibre'))) ? `
                            <div class="store-icon ${isRunning && activeSites.includes('mercadolibre') ? 'pulsing' : (isRunning && !activeSites.includes('mercadolibre') ? 'finished' : '')}" title="Mercado Libre">
                                <img src="assets/markets/ml.png" alt="ML">
                            </div>
                        ` : ''}
                    </div>
                    <div class="utility-btns">
                        <button class="btn btn-download" data-action="download" data-id="${id}" title="Descargar JSON">
                            <img src="assets/icons/arrow-down-to-line.png" class="btn-icon">
                        </button>
                        <button class="btn btn-delete" data-action="remove" data-id="${id}" title="Eliminar">
                            <img src="assets/icons/trash.png" class="btn-icon">
                        </button>
                    </div>
                </div>
            </div>

            <div class="content-wrapper">
                <div class="content-expanded">
                    ${analysisHTML}
                </div>
            </div>
        </div>
    `;
}
