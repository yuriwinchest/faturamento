import { useState } from 'react';
import DataInputSection from './components/DataInputSection';
import ResultsTable from './components/ResultsTable';
import { BillingResult, PricingRule, SocData } from './types';
import { reconcileData, calculateBill } from './services/calculationService';
import { analyzeBilling } from './services/geminiService';
import ReactMarkdown from 'react-markdown';

function App() {
  const [results, setResults] = useState<BillingResult[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleDataLoaded = (socData: SocData[], pricingData: PricingRule[]) => {
    const calculatedResults = reconcileData(socData, pricingData);
    setResults(calculatedResults);
    setAnalysis(null); // Reset previous analysis
  };

  const handleDelete = (cnpj: string) => {
    setResults(prev => prev.filter(item => item.socData.cnpj !== cnpj));
    setAnalysis(null); // Invalidate analysis if data changes
  };

  const handleUpdate = (cnpj: string, newEmployees: number) => {
    setResults(prev => prev.map(item => {
      if (item.socData.cnpj === cnpj) {
        const newSocData = { ...item.socData, activeEmployees: newEmployees };
        // Recalculate bill with new employee count
        return calculateBill(newSocData, item.pricingRule);
      }
      return item;
    }));
    setAnalysis(null); // Invalidate analysis if data changes
  };

  const generateReport = async () => {
    if (results.length === 0) return;
    setIsAnalyzing(true);
    const report = await analyzeBilling(results);
    setAnalysis(report);
    setIsAnalyzing(false);
  };

  const totalRevenue = results.reduce((acc, curr) => acc + curr.calculatedAmount, 0);
  const readyCount = results.filter(r => r.status === 'READY').length;
  const errorCount = results.filter(r => r.status !== 'READY').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 relative overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">

      {/* Background Decorative Blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto p-6 md:p-10 space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-800/60 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">BillingMaster</h1>
            </div>
            <p className="text-slate-400 font-light tracking-wide">Conciliação Inteligente <span className="text-cyan-400 font-medium">SOC</span> + <span className="text-indigo-400 font-medium">Omie</span></p>
          </div>

          <div className="flex items-center gap-4">
            {results.length > 0 && (
              <div className="flex gap-4">
                <div className="bg-slate-900/50 backdrop-blur-md border border-slate-700/50 rounded-2xl p-4 min-w-[140px] hover:border-slate-600 transition-colors group">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold group-hover:text-cyan-400 transition-colors">Faturamento</span>
                  <div className="text-2xl font-bold text-white mt-1 drop-shadow-sm">{totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur-md border border-slate-700/50 rounded-2xl p-4 min-w-[100px] hover:border-slate-600 transition-colors group">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold group-hover:text-emerald-400 transition-colors">Processados</span>
                  <div className="text-2xl font-bold text-slate-200 mt-1">{readyCount}</div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur-md border border-slate-700/50 rounded-2xl p-4 min-w-[100px] hover:border-slate-600 transition-colors group">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold group-hover:text-rose-400 transition-colors">Pendentes</span>
                  <div className="text-2xl font-bold text-rose-400 mt-1">{errorCount}</div>
                </div>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all shadow-lg ${sidebarCollapsed
                  ? 'bg-slate-800 text-white border-slate-600 hover:bg-slate-700'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              title={sidebarCollapsed ? 'Expandir lateral' : 'Recolher lateral'}
            >
              {sidebarCollapsed ? 'Expandir Lateral' : 'Recolher Lateral'}
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Input */}
          <div className={`${sidebarCollapsed ? 'hidden' : 'lg:col-span-3'} space-y-6`}>
            <DataInputSection onDataLoaded={handleDataLoaded} />

            {/* Omie Export Simulator */}
            {results.length > 0 && (
              <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900/80 to-purple-900/80 backdrop-blur-xl border border-indigo-700/50 text-white p-6 rounded-2xl shadow-2xl">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>

                <h3 className="relative font-bold text-lg mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Exportar para Omie
                </h3>
                <p className="relative text-indigo-200/80 text-sm mb-6 font-light">
                  Gere o arquivo padrão para atualizar os contratos em lote no ERP automaticamente.
                </p>
                <button className="relative w-full bg-white text-indigo-950 font-bold py-3 rounded-xl hover:bg-indigo-50 transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]">
                  Baixar Planilha XML
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Results & AI */}
          <div className={`${sidebarCollapsed ? 'lg:col-span-12' : 'lg:col-span-9'} space-y-8`}>

            {/* Results Table */}
            {results.length > 0 ? (
              <ResultsTable
                results={results}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
            ) : (
              <div className="bg-slate-900/40 backdrop-blur-md rounded-3xl border border-slate-800/50 p-16 text-center text-slate-500 border-dashed">
                <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h3 className="text-xl font-medium text-slate-300 mb-2">Aguardando Dados</h3>
                <p className="font-light">Importe os dados do SOC e as regras de preço para iniciar a conciliação.</p>
              </div>
            )}

            {/* AI Analysis Section */}
            {results.length > 0 && (
              <div className="relative bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-8 shadow-2xl overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500"></div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                  <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-sm">✨</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Gemini Insights</span>
                  </h2>
                  <button
                    onClick={generateReport}
                    disabled={isAnalyzing}
                    className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all border border-transparent ${isAnalyzing
                      ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600 hover:border-slate-500 shadow-lg'
                      }`}
                  >
                    {isAnalyzing ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Processando IA...
                      </span>
                    ) : 'Gerar Relatório Executivo'}
                  </button>
                </div>

                <div className="prose prose-invert max-w-none prose-headings:text-cyan-400 prose-strong:text-white prose-p:text-slate-300">
                  {analysis ? (
                    <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800/50">
                      <ReactMarkdown>{analysis}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                      <svg className="w-12 h-12 mb-3 opacity-20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" /></svg>
                      <p className="font-light">Clique para gerar uma análise financeira detalhada.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>


      </div>
    </div>
  );
}

export default App;
