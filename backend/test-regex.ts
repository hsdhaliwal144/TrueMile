// Test the amount parsing regex

const text = " LINE HAUL RATE                               2800.00 THE DRIVER MUST ACCEPT MACROPOINT";

console.log("=== REGEX TEST ===");
console.log("Text to parse:", text);
console.log("");

// Test Pattern 1: LINE HAUL RATE
const pattern1 = /LINE\s+HAUL\s+RATE\s+(\d{1,}(?:,\d{3})*(?:\.\d{2})?)/i;
const match1 = text.match(pattern1);

console.log("Pattern 1: /LINE\\s+HAUL\\s+RATE\\s+(\\d{1,}(?:,\\d{3})*(?:\\.\\d{2})?)/i");
console.log("Match found:", match1?.[0]);
console.log("Captured amount:", match1?.[1]);
console.log("Parsed number:", match1 ? parseFloat(match1[1].replace(/,/g, '')) : 0);
console.log("");

// Test with comma
const text2 = " LINE HAUL RATE                               2,800.00 THE DRIVER";
const match2 = text2.match(pattern1);

console.log("=== TEST WITH COMMA ===");
console.log("Text to parse:", text2);
console.log("Match found:", match2?.[0]);
console.log("Captured amount:", match2?.[1]);
console.log("Parsed number:", match2 ? parseFloat(match2[1].replace(/,/g, '')) : 0);
console.log("");

// Test with larger number
const text3 = " LINE HAUL RATE                               12800.00 THE DRIVER";
const match3 = text3.match(pattern1);

console.log("=== TEST WITH LARGER NUMBER ===");
console.log("Text to parse:", text3);
console.log("Match found:", match3?.[0]);
console.log("Captured amount:", match3?.[1]);
console.log("Parsed number:", match3 ? parseFloat(match3[1].replace(/,/g, '')) : 0);
