export enum PricingModel {
  TIERED = 'TIERED', // Ex: Fixed price up to X employees, then Y per extra
  PER_HEAD_MIN = 'PER_HEAD_MIN', // Ex: Price per head, but minimum X employees charged
  FLAT = 'FLAT' // Fixed price regardless of employees
}

export interface SocData {
  cnpj: string;
  companyName: string;
  activeEmployees: number;
}

export interface PricingRule {
  cnpj: string;
  model: PricingModel;
  basePrice: number; // Used for TIERED (base) or PER_HEAD (price per unit)
  includedEmployees?: number; // For TIERED (e.g., up to 5)
  excessPrice?: number; // For TIERED (price per extra)
  minEmployees?: number; // For PER_HEAD_MIN
}

export interface BillingResult {
  socData: SocData;
  pricingRule: PricingRule | undefined;
  calculatedAmount: number;
  details: string;
  status: 'READY' | 'MISSING_RULE' | 'MISSING_SOC';
}

export interface DashboardStats {
  totalRevenue: number;
  companiesProcessed: number;
  companiesMissingRules: number;
}
