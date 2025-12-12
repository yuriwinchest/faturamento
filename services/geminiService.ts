import { GoogleGenAI } from "@google/genai";
import { BillingResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const analyzeBilling = async (results: BillingResult[]): Promise<string> => {
  try {
    const successfulBills = results.filter(r => r.status === 'READY');
    const totalRev = successfulBills.reduce((acc, curr) => acc + curr.calculatedAmount, 0);
    
    // Prepare a summarized dataset for the LLM to avoid token limits with huge lists
    const summaryData = successfulBills.map(b => ({
      company: b.socData.companyName,
      employees: b.socData.activeEmployees,
      amount: b.calculatedAmount,
      details: b.details
    }));

    const prompt = `
      Você é um assistente financeiro especialista em faturamento B2B.
      Analise os dados de faturamento deste mês abaixo.
      
      Resumo Estatístico:
      - Total Faturado: R$ ${totalRev.toFixed(2)}
      - Empresas Processadas: ${successfulBills.length}
      
      Dados Detalhados (Amostra):
      ${JSON.stringify(summaryData.slice(0, 30))} 
      (Nota: A lista pode estar truncada se for muito longa).

      Por favor, gere um "Relatório Executivo de Faturamento" curto e profissional em Markdown.
      1. Destaque o faturamento total.
      2. Identifique as 3 empresas que mais pagam.
      3. Sugira ações se houver empresas com faturamento muito baixo ou anomalias visíveis.
      4. Use um tom formal em Português.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Não foi possível gerar a análise no momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao conectar com a IA para análise.";
  }
};
