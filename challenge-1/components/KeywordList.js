import { renderKeywordItem } from './KeywordItem.js';

export function renderKeywordList(keywords, expandedId, results) {
    if (!keywords || keywords.length === 0) return '';

    return `
        <div class="list-wrapper">
            ${keywords.map(k => {
        const isExpanded = expandedId === k.id;
        return renderKeywordItem(k, isExpanded, results[k.id]);
    }).join('')}
        </div>
    `;
}
