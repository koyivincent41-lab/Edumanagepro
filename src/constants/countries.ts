export interface Country {
  name: string;
  code: string;
  currency: string;
  currencySymbol: string;
}

export const COUNTRIES: Country[] = [
  // Africa
  { name: 'Kenya', code: 'KE', currency: 'KES', currencySymbol: 'KSh' },
  { name: 'Uganda', code: 'UG', currency: 'UGX', currencySymbol: 'USh' },
  { name: 'Tanzania', code: 'TZ', currency: 'TZS', currencySymbol: 'TSh' },
  { name: 'Rwanda', code: 'RW', currency: 'RWF', currencySymbol: 'FRw' },
  { name: 'Nigeria', code: 'NG', currency: 'NGN', currencySymbol: '₦' },
  { name: 'South Africa', code: 'ZA', currency: 'ZAR', currencySymbol: 'R' },
  { name: 'Ghana', code: 'GH', currency: 'GHS', currencySymbol: 'GH₵' },
  { name: 'Ethiopia', code: 'ET', currency: 'ETB', currencySymbol: 'Br' },
  { name: 'Egypt', code: 'EG', currency: 'EGP', currencySymbol: 'E£' },
  
  // Europe
  { name: 'United Kingdom', code: 'GB', currency: 'GBP', currencySymbol: '£' },
  { name: 'France', code: 'FR', currency: 'EUR', currencySymbol: '€' },
  { name: 'Germany', code: 'DE', currency: 'EUR', currencySymbol: '€' },
  { name: 'Italy', code: 'IT', currency: 'EUR', currencySymbol: '€' },
  { name: 'Spain', code: 'ES', currency: 'EUR', currencySymbol: '€' },
  
  // Americas
  { name: 'United States', code: 'US', currency: 'USD', currencySymbol: '$' },
  { name: 'Canada', code: 'CA', currency: 'CAD', currencySymbol: 'C$' },
  { name: 'Brazil', code: 'BR', currency: 'BRL', currencySymbol: 'R$' },
  
  // Asia
  { name: 'India', code: 'IN', currency: 'INR', currencySymbol: '₹' },
  { name: 'China', code: 'CN', currency: 'CNY', currencySymbol: '¥' },
  { name: 'Japan', code: 'JP', currency: 'JPY', currencySymbol: '¥' },
  { name: 'United Arab Emirates', code: 'AE', currency: 'AED', currencySymbol: 'د.إ' },
  
  // Oceania
  { name: 'Australia', code: 'AU', currency: 'AUD', currencySymbol: 'A$' },
];
