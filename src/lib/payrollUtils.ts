export function calculatePAYE(taxablePay: number): number {
  // Personal relief
  const personalRelief = 2400;
  
  let paye = 0;
  
  // Bracket 1: 0 - 24,000 @ 10%
  if (taxablePay <= 24000) {
    paye = taxablePay * 0.1;
  } else {
    paye += 24000 * 0.1;
    
    // Bracket 2: 24,001 - 32,333 @ 25%
    if (taxablePay <= 32333) {
      paye += (taxablePay - 24000) * 0.25;
    } else {
      paye += (32333 - 24000) * 0.25;
      
      // Bracket 3: Above 32,333 @ 30%
      paye += (taxablePay - 32333) * 0.3;
    }
  }
  
  // Apply personal relief
  paye = Math.max(0, paye - personalRelief);
  
  return Math.round(paye);
}
