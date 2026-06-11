/**
 * Formats a standard YYYY-MM-DD date string into the requested format pattern.
 * @param {string} dateStr Date string in 'YYYY-MM-DD' format
 * @param {string} format Format pattern (e.g. 'DD-MM-YYYY', 'DD MMM YYYY')
 * @returns {string} Formatted date string
 */
export function formatDate(dateStr, format) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    
    const year = parts[0];
    const month = parts[1]; // '01' to '12'
    const day = parts[2];  // '01' to '31'

    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(month, 10) - 1;
    const mmm = monthsShort[monthIndex] || month;

    switch (format) {
        case 'DD-MM-YYYY':
            return `${day}-${month}-${year}`;
        case 'DD/MM/YYYY':
            return `${day}/${month}/${year}`;
        case 'MM/DD/YYYY':
            return `${month}/${day}/${year}`;
        case 'DD MMM YYYY':
            return `${day} ${mmm} ${year}`;
        case 'MMM DD, YYYY':
            return `${mmm} ${day}, ${year}`;
        case 'YYYY-MM-DD':
        default:
            return `${year}-${month}-${day}`;
    }
}
