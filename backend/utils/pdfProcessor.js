const pdf = require('pdf-parse');

/**
 * Custom page renderer for pdf-parse to handle layout-aware extraction.
 * Filters out headers, footers, and page numbers based on geometric position.
 */
async function render_page(pageData) {
    const render_options = {
        normalizeWhitespace: true,
        disableCombineTextItems: false
    };

    const textContent = await pageData.getTextContent(render_options);
    let lastY, text = '';
    
    // pageData.view is [x1, y1, x2, y2]. Height is y2 - y1.
    const viewport = pageData.view;
    const pageHeight = viewport[3] - viewport[1];
    
    // Define margins (e.g., 10% top and bottom)
    // In PDF coordinates, Y increases from bottom to top
    const marginSize = pageHeight * 0.1;
    const minY = marginSize;
    const maxY = pageHeight - marginSize;

    for (let item of textContent.items) {
        const y = item.transform[5];
        
        // Skip text items in the top or bottom margins (headers/footers/page numbers)
        if (y < minY || y > maxY) {
            continue;
        }

        if (lastY === y || !lastY) {
            text += item.str;
        } else {
            text += '\n' + item.str;
        }
        lastY = y;
    }

    return text;
}

/**
 * Post-processes extracted text to remove common noise like isolated page numbers.
 */
function cleanText(text) {
    if (!text) return '';

    return text
        // Remove lines that are just a single number (often page numbers that escaped geometric filtering)
        .replace(/^\s*\d+\s*$/gm, '')
        // Remove "Page X" or "Page X of Y" patterns
        .replace(/^\s*Page\s+\d+(\s+of\s+\d+)?\s*$/gmi, '')
        // Remove excessive whitespace/newlines
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
}

/**
 * Detects and removes repetitive headers/footers across multiple pages.
 * (Simplified implementation for this iteration)
 */
function removeRepetitiveLines(pageTexts) {
    if (pageTexts.length < 3) return pageTexts.join('\n\n');

    const lineCounts = {};
    const totalPages = pageTexts.length;

    // Count occurrence of every line across all pages
    pageTexts.forEach(page => {
        const lines = new Set(page.split('\n').map(l => l.trim()));
        lines.forEach(line => {
            if (line.length > 10) { // Only track reasonably long lines
                lineCounts[line] = (lineCounts[line] || 0) + 1;
            }
        });
    });

    // If a line appears in almost every page, it's likely a header/footer
    const threshold = totalPages * 0.8;
    
    return pageTexts.map(page => {
        return page.split('\n')
            .filter(line => {
                const trimmed = line.trim();
                return !(trimmed.length > 10 && lineCounts[trimmed] >= threshold);
            })
            .join('\n');
    }).join('\n\n');
}

/**
 * Main entry point for PDF processing
 */
async function processPdf(buffer) {
    const options = {
        pagerender: render_page
    };

    const data = await pdf(buffer, options);
    // Since pdf-parse merges all pages into data.text, if we want repetitive detection
    // we would need a more complex hook. For now, we'll use geometric filtering + cleanText.
    return cleanText(data.text);
}

module.exports = {
    processPdf,
    cleanText,
    render_page
};
