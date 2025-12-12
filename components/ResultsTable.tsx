import React, { useState, useMemo } from 'react';
import { BillingResult } from '../types';
import { utils, writeFile } from 'xlsx';

interface ResultsTableProps {
  results: BillingResult[];
  onDelete: (cnpj: string) => void;
  onUpdate: (cnpj: string, newEmployees: number) => void;
}

type SortKey = 'status' | 'companyName' | 'activeEmployees' | 'calculatedAmount';
type SortDirection = 'asc' | 'desc';

const getRuleLabel = (model?: string) => {
  switch (model) {
    case 'TIERED': return 'Escalonado';
    case 'PER_HEAD_MIN': return 'Mínimo/Vidas';
    case 'FLAT': return 'Valor Fixo';
    default: return '-';
  }
};

const StatusBadge = ({ status, details }: { status: string, details: string }) => {
  const isReady = status === 'READY';
  const tooltipText = isReady 
    ? "Cálculo realizado com sucesso" 
    : (details || "Erro desconhecido");

  return (
    <div className="group relative flex items-center w-fit">
      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold cursor-help transition-all border ${
        isReady 
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:shadow-[0_0_10px_rgba(52,211,153,0.3)]' 
          : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20 hover:shadow-[0_0_10px_rgba(251,113,133,0.3)]'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isReady ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
        {isReady ? 'Pronto' : 'Erro'}
      </span>
      
      {/* Tooltip */}
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden group-hover:block z-50 w-max max-w-[250px] animate-fadeIn">
        <div className="bg-slate-800 text-slate-200 text-xs rounded-lg py-2 px-3 shadow-xl border border-slate-700 relative">
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800"></div>
          {tooltipText}
        </div>
      </div>
    </div>
  );
};

const ResultsTable: React.FC<ResultsTableProps> = ({ results, onDelete, onUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'READY' | 'ERROR'>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'status',
    direction: 'asc' 
  });

  // State for inline editing
  const [editingCnpj, setEditingCnpj] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  const startEditing = (item: BillingResult) => {
    setEditingCnpj(item.socData.cnpj);
    setEditValue(item.socData.activeEmployees);
  };

  const cancelEditing = () => {
    setEditingCnpj(null);
    setEditValue(0);
  };

  const saveEditing = () => {
    if (editingCnpj) {
      onUpdate(editingCnpj, editValue);
      setEditingCnpj(null);
    }
  };

  const processedResults = useMemo(() => {
    let data = [...results];

    // 1. Filtering
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      data = data.filter(item => 
        item.socData.companyName.toLowerCase().includes(lowerTerm) ||
        item.socData.cnpj.includes(lowerTerm)
      );
    }

    if (statusFilter !== 'ALL') {
      data = data.filter(item => {
        const isReady = item.status === 'READY';
        return statusFilter === 'READY' ? isReady : !isReady;
      });
    }

    // 2. Sorting
    data.sort((a, b) => {
      let valA: any, valB: any;

      switch (sortConfig.key) {
        case 'companyName':
          valA = a.socData.companyName.toLowerCase();
          valB = b.socData.companyName.toLowerCase();
          break;
        case 'activeEmployees':
          valA = a.socData.activeEmployees;
          valB = b.socData.activeEmployees;
          break;
        case 'calculatedAmount':
          valA = a.calculatedAmount;
          valB = b.calculatedAmount;
          break;
        case 'status':
          valA = a.status === 'READY' ? 1 : 0;
          valB = b.status === 'READY' ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [results, searchTerm, statusFilter, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const exportToCSV = () => {
    const dataToExport = processedResults.map(item => ({
      Status: item.status === 'READY' ? 'Pronto' : 'Erro',
      CNPJ: item.socData.cnpj,
      Empresa: item.socData.companyName,
      'Funcionários Ativos': item.socData.activeEmployees,
      'Modelo de Preço': getRuleLabel(item.pricingRule?.model),
      'Detalhes do Cálculo': item.details,
      'Valor Total': item.calculatedAmount
    }));

    const ws = utils.json_to_sheet(dataToExport);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Faturamento");
    writeFile(wb, "conciliacao_faturamento.csv");
  };

  const HeaderCell = ({ label, sortKey, align = 'left' }: { label: string, sortKey: SortKey, align?: 'left' | 'right' }) => {
    const isSorted = sortConfig.key === sortKey;
    const isAsc = sortConfig.direction === 'asc';

    return (
      <th 
        className={`px-6 py-4 ${align === 'right' ? 'text-right' : 'text-left'} text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-cyan-400 transition-colors select-none group`}
        onClick={() => handleSort(sortKey)}
      >
        <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : ''}`}>
          {label}
          <span className="flex flex-col justify-center h-4 w-4">
            {isSorted ? (
               isAsc ? (
                 <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
               ) : (
                 <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
               )
            ) : (
              <svg className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
            )}
          </span>
        </div>
      </th>
    );
  };

  if (results.length === 0) return null;

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-700/50 overflow-hidden">
      {/* Toolbar */}
      <div className="px-6 py-5 border-b border-slate-700/50 bg-slate-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-lg font-bold text-white tracking-wide">Conciliação</h2>
           <p className="text-xs text-slate-400 mt-1 font-mono">
             {processedResults.length} registros encontrados
           </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative group">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
               <svg className="h-4 w-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
               </svg>
             </div>
             <input
               type="text"
               className="pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 w-full sm:w-64 outline-none transition-all placeholder-slate-600"
               placeholder="Buscar empresa ou CNPJ..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>

          {/* Status Filter */}
          <select
            className="pl-3 pr-8 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-300 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none cursor-pointer hover:bg-slate-900 transition-colors"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="ALL">Todos</option>
            <option value="READY">Prontos</option>
            <option value="ERROR">Erros</option>
          </select>

          {/* Export Button */}
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 hover:border-slate-600 transition-all font-medium text-sm group"
            title="Exportar tabela atual para CSV"
          >
            <svg className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800/50">
          <thead className="bg-slate-900/80">
            <tr>
              <HeaderCell label="Status" sortKey="status" />
              <HeaderCell label="Empresa" sortKey="companyName" />
              <HeaderCell label="Ativos" sortKey="activeEmployees" />
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                Regra
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                Detalhes do Cálculo
              </th>
              <HeaderCell label="Total" sortKey="calculatedAmount" align="right" />
              <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {processedResults.map((item, idx) => {
              const isEditing = editingCnpj === item.socData.cnpj;
              
              return (
                <tr 
                  key={`${item.socData.cnpj}-${idx}`} 
                  className={`transition-colors duration-200 ${
                    item.status !== 'READY' 
                      ? 'bg-rose-900/5 hover:bg-rose-900/10' 
                      : 'hover:bg-slate-800/30'
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={item.status} details={item.details} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">{item.socData.companyName}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{item.socData.cnpj}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    {isEditing ? (
                      <div className="flex items-center">
                        <input 
                          type="number"
                          min="0"
                          className="w-20 p-1.5 bg-slate-950 border border-cyan-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-400 text-right text-white font-mono"
                          value={editValue}
                          onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                          onKeyDown={(e) => {
                            if(e.key === 'Enter') saveEditing();
                            if(e.key === 'Escape') cancelEditing();
                          }}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <span className="font-mono">{item.socData.activeEmployees}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-xs font-mono px-2 py-1 rounded border ${
                      item.pricingRule 
                        ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' 
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}>
                      {getRuleLabel(item.pricingRule?.model)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 max-w-[250px] truncate" title={item.details}>
                    {item.details}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-slate-200 tracking-wide">
                    {item.calculatedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    {isEditing ? (
                       <div className="flex justify-center items-center space-x-2">
                        <button 
                          onClick={saveEditing}
                          className="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg transition-colors border border-emerald-500/30"
                          title="Salvar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </button>
                        <button 
                          onClick={cancelEditing}
                          className="p-2 bg-slate-700/50 text-slate-400 hover:bg-slate-700 rounded-lg transition-colors border border-slate-600"
                          title="Cancelar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-center items-center space-x-3 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            const cleanCnpj = item.socData.cnpj.replace(/[^\d]/g, '');
                            window.open(`https://app.omie.com.br/b2b/painel/?cnpj=${cleanCnpj}`, '_blank');
                          }}
                          className="text-slate-400 hover:text-indigo-400 transition-colors"
                          title="Link para Omie"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </button>
                        <button 
                          onClick={() => startEditing(item)}
                          className="text-slate-400 hover:text-cyan-400 transition-colors"
                          title="Editar"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button 
                          onClick={() => {
                            if(window.confirm(`Tem certeza que deseja excluir ${item.socData.companyName}?`)) {
                              onDelete(item.socData.cnpj);
                            }
                          }}
                          className="text-slate-400 hover:text-rose-400 transition-colors"
                          title="Excluir"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            
            {processedResults.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <svg className="w-12 h-12 text-slate-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <p>Nenhum resultado encontrado para os filtros.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsTable;