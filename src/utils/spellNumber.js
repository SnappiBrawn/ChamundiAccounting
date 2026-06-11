const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", 
              "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function convertTwoDigits(num) {
    if (num < 20) return ones[num];
    const tenVal = Math.floor(num / 10);
    const oneVal = num % 10;
    return tens[tenVal] + (oneVal > 0 ? " " + ones[oneVal] : "");
}

function convertThreeDigits(num) {
    const hundredVal = Math.floor(num / 100);
    const rest = num % 100;
    let result = "";
    if (hundredVal > 0) {
        result += ones[hundredVal] + " Hundred";
    }
    if (rest > 0) {
        if (result !== "") result += " ";
        result += convertTwoDigits(rest);
    }
    return result;
}

export function spellNumber(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return "Zero Rupees Only";
    
    // Round to two decimal places
    const roundedAmt = Math.round(amount * 100) / 100;
    if (roundedAmt === 0) return "Rupees Zero Only";
    
    const isNegative = roundedAmt < 0;
    const absAmt = Math.abs(roundedAmt);
    
    const integerPart = Math.floor(absAmt);
    const paisePart = Math.round((absAmt - integerPart) * 100);
    
    let words = "";
    
    if (integerPart > 0) {
        let remaining = integerPart;
        
        // Crores
        if (remaining >= 10000000) {
            const crores = Math.floor(remaining / 10000000);
            words += (words ? " " : "") + convertThreeDigits(crores) + " Crore";
            remaining = remaining % 10000000;
        }
        
        // Lakhs
        if (remaining >= 100000) {
            const lakhs = Math.floor(remaining / 100000);
            words += (words ? " " : "") + convertTwoDigits(lakhs) + " Lakh";
            remaining = remaining % 100000;
        }
        
        // Thousands
        if (remaining >= 1000) {
            const thousands = Math.floor(remaining / 1000);
            words += (words ? " " : "") + convertTwoDigits(thousands) + " Thousand";
            remaining = remaining % 1000;
        }
        
        // Hundreds & Units
        if (remaining > 0) {
            words += (words ? " " : "") + convertThreeDigits(remaining);
        }
    }
    
    let result = (isNegative ? "Minus " : "") + "Rupees " + (words || "Zero");
    
    if (paisePart > 0) {
        result += " and " + convertTwoDigits(paisePart) + " Paise";
    }
    
    result += " Only";
    return result;
}
