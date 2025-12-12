import React, { useState, useRef } from 'react';
import { PricingModel, PricingRule, SocData } from '../types';
import { read, utils } from 'xlsx';

interface DataInputSectionProps {
  onDataLoaded: (socData: SocData[], pricingData: PricingRule[]) => void;
}

const DataInputSection: React.FC<DataInputSectionProps> = ({ onDataLoaded }) => {
  const [activeTab, setActiveTab] = useState<'soc' | 'pricing'>('soc');
  const [socText, setSocText] = useState('');
  const [pricingText, setPricingText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDemoData = () => {
    const demoSoc = `12.345.678/0001-90,Empresa Alpha Ltda,4
98.765.432/0001-10,Beta Industries,15
11.222.333/0001-55,Gamma Tech,8
44.555.666/0001-99,Delta Services,200`;

    const demoPricing = `12.345.678/0001-90,TIERED,129,5,12,0
98.765.432/0001-10,PER_HEAD_MIN,13,0,0,10
11.222.333/0001-55,TIERED,129,5,12,0`;

    setSocText(demoSoc);
    setPricingText(demoPricing);
  };

  const processData = () => {
    // Process SOC
    const socLines = socText.trim().split('\n');
    const socData: SocData[] = socLines.map(line => {
      const [cnpj, companyName, activeEmployees] = line.split(',');
      if (!cnpj) return null;
      return {
        cnpj: cnpj?.trim(),
        companyName: companyName?.trim() || 'Desconhecida',
        activeEmployees: parseInt(activeEmployees?.trim() || '0', 10)
      };
    }).filter((x): x is SocData => x !== null);

    // Process Pricing
    const pricingLines = pricingText.trim().split('\n');
    const pricingData = pricingLines.map(line => {
      const [cnpj, model, basePrice, includedEmployees, excessPrice, minEmployees] = line.split(',');
      if (!cnpj) return null;
      return {
        cnpj: cnpj?.trim(),
        model: model?.trim() as PricingModel,
        basePrice: parseFloat(basePrice || '0'),
        includedEmployees: parseFloat(includedEmployees || '0'),
        excessPrice: parseFloat(excessPrice || '0'),
        minEmployees: parseFloat(minEmployees || '0')
      };
    }).filter(Boolean) as PricingRule[];

    onDataLoaded(socData, pricingData);
  };

  const handleFile = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = read(arrayBuffer);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const csv = utils.sheet_to_csv(worksheet);

      if (activeTab === 'soc') {
        setSocText(csv);
      } else {
        setPricingText(csv);
      }
    } catch (error) {
      console.error("Erro ao ler arquivo", error);
      alert("Erro ao ler o arquivo. Verifique se é um Excel ou CSV válido.");
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-slate-700/50 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white tracking-wide">1. Importação</h2>
        <div className="flex gap-2">
          <button
            onClick={loadDemoData}
            className="text-xs text-slate-400 hover:text-white font-medium transition-colors border border-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-700"
          >
            Demo
          </button>
        </div>
      </div>

      <div className="flex p-1 mb-6 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
        <button
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'soc'
            ? 'bg-slate-800 text-white shadow-md ring-1 ring-slate-700'
            : 'text-slate-500 hover:text-slate-300'
            }`}
          onClick={() => setActiveTab('soc')}
        >
          SOC (Ativos)
        </button>
        <button
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'pricing'
            ? 'bg-slate-800 text-white shadow-md ring-1 ring-slate-700'
            : 'text-slate-500 hover:text-slate-300'
            }`}
          onClick={() => setActiveTab('pricing')}
        >
          Contratos (Omie)
        </button>
      </div>

      <div className="flex flex-col space-y-4 mb-6">

        {/* Drop Zone */}
        <div
          className={`relative group border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${isDragging
            ? 'border-cyan-400 bg-cyan-900/10'
            : 'border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800/30'
            }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".csv, .xlsx, .xls"
            onChange={onFileInputChange}
            title="Upload file"
          />

          <div className="flex flex-col items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isDragging ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-cyan-400 group-hover:scale-110 group-hover:bg-slate-700'}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                Clique para enviar ou arraste aqui
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Suporta Excel (.xlsx) e CSV
              </p>
            </div>
          </div>
        </div>

        {/* Text Area (Preview/Edit) */}
        <div className="relative animate-fadeIn">
          <div className="absolute top-3 right-3 z-10">
            <span className="text-[10px] font-mono text-slate-500 bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
              {activeTab === 'soc' ? 'CNPJ, Nome, Ativos' : 'CNPJ, Regra, Preços...'}
            </span>
          </div>
          <textarea
            className="w-full min-h-[150px] p-4 bg-slate-950 border border-slate-800 rounded-2xl font-mono text-xs md:text-sm text-slate-300 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all outline-none resize-none placeholder-slate-700"
            placeholder={activeTab === 'soc' ? "Cole os dados ou use o upload acima..." : "Cole as regras ou use o upload acima..."}
            value={activeTab === 'soc' ? socText : pricingText}
            onChange={(e) => activeTab === 'soc' ? setSocText(e.target.value) : setPricingText(e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>

      <button
        onClick={processData}
        className="w-full relative group overflow-hidden bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-cyan-500/30 active:scale-[0.99] shrink-0"
      >
        <div className="absolute top-0 left-0 w-full h-full bg-white/20 -translate-x-full group-hover:translate-x-0 transform transition-transform duration-500 skew-x-12"></div>
        <span className="relative flex justify-center items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
          Processar Conciliação
        </span>
      </button>
    </div>
  );
};

export default DataInputSection;
