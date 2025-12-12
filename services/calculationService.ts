import { BillingResult, PricingModel, PricingRule, SocData } from '../types';

export const cleanCnpj = (cnpj: string): string => {
  return cnpj.replace(/[^\d]/g, '');
};

export const calculateBill = (socData: SocData, rule?: PricingRule): BillingResult => {
  if (!rule) {
    return {
      socData,
      pricingRule: undefined,
      calculatedAmount: 0,
      details: 'Regra de contrato não encontrada',
      status: 'MISSING_RULE',
    };
  }

  let amount = 0;
  let details = '';

  switch (rule.model) {
    case PricingModel.TIERED:
      // Ex: R$ 129,00 up to 5 employees. Above 5, + R$ 12,00 each.
      const included = rule.includedEmployees || 0;
      const excessRate = rule.excessPrice || 0;
      
      if (socData.activeEmployees <= included) {
        amount = rule.basePrice;
        details = `Fixo (Até ${included} func.)`;
      } else {
        const excessCount = socData.activeEmployees - included;
        const excessTotal = excessCount * excessRate;
        amount = rule.basePrice + excessTotal;
        details = `Base R$${rule.basePrice} + (${excessCount} extras x R$${excessRate})`;
      }
      break;

    case PricingModel.PER_HEAD_MIN:
      // Ex: R$ 13,00 per head, minimum 10.
      const min = rule.minEmployees || 0;
      const rate = rule.basePrice; // In this model, basePrice acts as unit price
      const billableCount = Math.max(socData.activeEmployees, min);
      
      amount = billableCount * rate;
      details = `${billableCount} faturados x R$${rate} (Mínimo: ${min})`;
      break;

    case PricingModel.FLAT:
      amount = rule.basePrice;
      details = 'Valor fixo mensal';
      break;
      
    default:
      amount = 0;
      details = 'Modelo desconhecido';
  }

  return {
    socData,
    pricingRule: rule,
    calculatedAmount: amount,
    details,
    status: 'READY',
  };
};

export const reconcileData = (socList: SocData[], rulesList: PricingRule[]): BillingResult[] => {
  const results: BillingResult[] = [];
  
  // Create a map for fast lookup of rules by CNPJ
  const rulesMap = new Map<string, PricingRule>();
  rulesList.forEach(r => rulesMap.set(cleanCnpj(r.cnpj), r));

  // Process SOC data
  socList.forEach(soc => {
    const cleanId = cleanCnpj(soc.cnpj);
    const rule = rulesMap.get(cleanId);
    results.push(calculateBill(soc, rule));
  });

  return results;
};
