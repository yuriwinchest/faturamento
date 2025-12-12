import React, { useState, useMemo, Fragment } from 'react';
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

const StatusBadge = ({ status }: { status: string }) => {
  const isReady = status === 'READY';
  
  return (
    <div className="flex items-center w-fit">
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border shadow-[0_0_10px_rgba(0,0,0,0.2)] ${
        isReady 
          ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/30 shadow-emerald-900/20' 
          : 'bg-rose-950/30 text-rose-400 border-rose-500/30 shadow-rose-900/20'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isReady ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
        {isReady ? 'Pronto' : 'Erro'}
      </span>
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

  // State for row expansion
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (cnpj: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cnpj)) {
        newSet.delete(cnpj);
      } else {
        newSet.add(cnpj);
      }
      return newSet;
    });
  };

  const startEditing = (e: React.MouseEvent, item: BillingResult) => {
    e.stopPropagation();
    setEditingCnpj(item.socData.cnpj);
    setEditValue(item.socData.activeEmployees);
  };

  const cancelEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingCnpj(null);
    setEditValue(0);
  };

  const saveEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
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
        className={`px-6 py-5 ${align === 'right' ? 'text-right' : 'text-left'} text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em] cursor-pointer hover:text-cyan-400 transition-colors select-none group border-b border-white/5`}
        onClick={() => handleSort(sortKey)}
      >
        <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : ''}`}>
          {label}
          <span className="flex flex-col justify-center h-4 w-4">
            {isSorted ? (
               isAsc ? (
                 <svg className="w-3 h-3 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
               ) : (
                 <svg className="w-3 h-3 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
               )
            ) : (
              <svg className="w-3 h-3 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
            )}
          </span>
        </div>
      </th>
    );
  };

  if (results.length === 0) return null;

  return (
    <div className="bg-[#030712]/80 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/5 overflow-hidden ring-1 ring-white/5">
      {/* Toolbar */}
      <div className="px-6 py-6 border-b border-white/5 bg-[#030712]/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
             <span className="w-1 h-5 bg-gradient-to-b from-cyan-400 to-blue-600 rounded-full"></span>
             Conciliação
           </h2>
           <p className="text-xs text-slate-500 mt-1 font-mono pl-3">
             {processedResults.length} registros processados
           </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative group">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
               <svg className="h-4 w-4 text-slate-600 group-focus-within:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
               </svg>
             </div>
             <input
               type="text"
               className="pl-9 pr-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 w-full sm:w-64 outline-none transition-all placeholder-slate-700 hover:border-white/20"
               placeholder="Buscar empresa ou CNPJ..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>

          {/* Status Filter */}
          <select
            className="pl-3 pr-8 py-2 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-slate-300 focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none cursor-pointer hover:bg-white/5 transition-colors appearance-none"
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
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-white/10 hover:border-white/20 transition-all font-medium text-sm group shadow-lg shadow-black/50"
            title="Exportar tabela atual para CSV"
          >
            <svg className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-slate-600">
        <table className="min-w-full divide-y divide-white/5">
          <thead className="bg-[#02040a]">
            <tr>
              <HeaderCell label="Status" sortKey="status" />
              <HeaderCell label="Empresa" sortKey="companyName" />
              <HeaderCell label="Ativos" sortKey="activeEmployees" />
              <th className="px-6 py-5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em] border-b border-white/5">
                Regra
              </th>
              <th className="px-6 py-5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em] border-b border-white/5">
                Resumo
              </th>
              <HeaderCell label="Total" sortKey="calculatedAmount" align="right" />
              <th className="px-6 py-5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em] border-b border-white/5">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {processedResults.map((item, idx) => {
              const isEditing = editingCnpj === item.socData.cnpj;
              const isExpanded = expandedRows.has(item.socData.cnpj);
              const rowId = item.socData.cnpj;
              const hasError = item.status !== 'READY';
              
              return (
                <Fragment key={`${rowId}-${idx}`}>
                  <tr 
                    onClick={() => toggleRow(rowId)}
                    className={`group transition-all duration-300 cursor-pointer last:border-0 relative
                      ${isExpanded ? 'bg-white/[0.03]' : ''}
                      ${hasError 
                          ? 'hover:bg-rose-950/10' 
                          : 'hover:bg-cyan-900/5'}
                    `}
                  >
                     {/* Border Indicator for Error/Active */}
                    <td className="absolute left-0 top-0 bottom-0 w-[3px] transition-colors duration-300" 
                        style={{ backgroundColor: hasError ? '#f43f5e' : (isExpanded ? '#22d3ee' : 'transparent') }} />

                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                         {/* Chevron Icon */}
                        <div className={`transition-transform duration-300 text-slate-600 ${isExpanded ? 'rotate-180 text-cyan-400' : 'rotate-0 group-hover:text-slate-400'}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className={`text-sm font-medium transition-colors ${hasError ? 'text-rose-200' : 'text-slate-200 group-hover:text-cyan-200'}`}>{item.socData.companyName}</div>
                      <div className="text-[11px] text-slate-600 font-mono mt-1 tracking-wide">{item.socData.cnpj}</div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-300">
                      {isEditing ? (
                        <div className="flex items-center">
                          <input 
                            type="number"
                            min="0"
                            className="w-20 p-2 bg-slate-950 border border-cyan-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 text-right text-white font-mono text-sm shadow-[0_0_15px_rgba(34,211,238,0.1)]"
                            value={editValue}
                            onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                            onKeyDown={(e) => {
                              if(e.key === 'Enter') saveEditing(e as any);
                              if(e.key === 'Escape') cancelEditing(e as any);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-slate-300 group-hover:text-white transition-colors">{item.socData.activeEmployees}</span>
                      )}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className={`text-[10px] font-mono px-2 py-1 rounded border uppercase tracking-wide ${
                        item.pricingRule 
                          ? 'bg-indigo-950/20 text-indigo-300 border-indigo-500/20' 
                          : 'bg-slate-900 text-slate-600 border-slate-800'
                      }`}>
                        {getRuleLabel(item.pricingRule?.model)}
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-xs text-slate-500 max-w-[200px] truncate group-hover:text-slate-400 transition-colors">
                      {item.details}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-bold text-slate-200 tracking-wide font-mono">
                      {item.calculatedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-center text-sm font-medium">
                      {isEditing ? (
                         <div className="flex justify-center items-center space-x-2">
                          <button 
                            onClick={(e) => saveEditing(e)}
                            className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                            title="Salvar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <button 
                            onClick={(e) => cancelEditing(e)}
                            className="p-2 bg-slate-800 text-slate-400 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
                            title="Cancelar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center space-x-3 opacity-40 group-hover:opacity-100 transition-all duration-300">
                           <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const cleanCnpj = item.socData.cnpj.replace(/[^\d]/g, '');
                              window.open(`https://app.omie.com.br/b2b/painel/?cnpj=${cleanCnpj}`, '_blank');
                            }}
                            className="text-slate-400 hover:text-indigo-400 transition-colors hover:scale-110 transform"
                            title="Link para Omie"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </button>
                          <button 
                            onClick={(e) => startEditing(e, item)}
                            className="text-slate-400 hover:text-cyan-400 transition-colors hover:scale-110 transform"
                            title="Editar"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if(window.confirm(`Tem certeza que deseja excluir ${item.socData.companyName}?`)) {
                                onDelete(item.socData.cnpj);
                              }
                            }}
                            className="text-slate-400 hover:text-rose-400 transition-colors hover:scale-110 transform"
                            title="Excluir"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  
                  {/* Expanded Detail Row */}
                  <tr className="border-0">
                    <td colSpan={7} className="p-0 border-0">
                      <div 
                        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                        }`}
                      >
                        <div className="overflow-hidden bg-[#050b14]">
                          <div className={`p-6 pl-14 pr-8 text-sm border-b border-white/5 bg-gradient-to-r from-slate-900/50 to-transparent flex items-start gap-5 ${isExpanded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
                            <div className={`p-3 rounded-xl shrink-0 ${item.status === 'READY' ? 'bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-rose-500/10 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.1)]'}`}>
                              {item.status === 'READY' ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              )}
                            </div>
                            <div className="space-y-2 w-full">
                              <div className="flex justify-between items-start">
                                <span className="block font-bold text-slate-200 text-lg">
                                  {item.status === 'READY' ? 'Detalhes do Cálculo' : 'Erro na Conciliação'}
                                </span>
                                {item.pricingRule && (
                                  <span className="text-xs text-slate-500 font-mono bg-slate-900 px-2 py-1 rounded">
                                    ID Regra: {item.pricingRule.model}
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-400 leading-relaxed max-w-2xl">
                                {item.details}
                              </p>
                              {item.pricingRule && (
                                <div className="mt-4 pt-4 border-t border-white/5 text-xs text-slate-400 flex flex-wrap gap-6 font-mono">
                                  <div className="flex flex-col">
                                    <span className="text-slate-600 mb-1 uppercase tracking-wider text-[10px]">Preço Base</span>
                                    <span className="text-white text-sm">{item.pricingRule.basePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                  </div>
                                  {item.pricingRule.excessPrice && (
                                    <div className="flex flex-col">
                                      <span className="text-slate-600 mb-1 uppercase tracking-wider text-[10px]">Custo Excedente</span>
                                      <span className="text-white text-sm">{item.pricingRule.excessPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / vida</span>
                                    </div>
                                  )}
                                  {item.pricingRule.includedEmployees && (
                                    <div className="flex flex-col">
                                      <span className="text-slate-600 mb-1 uppercase tracking-wider text-[10px]">Vidas Inclusas</span>
                                      <span className="text-white text-sm">{item.pricingRule.includedEmployees}</span>
                                    </div>
                                  )}
                                   {item.pricingRule.minEmployees && (
                                    <div className="flex flex-col">
                                      <span className="text-slate-600 mb-1 uppercase tracking-wider text-[10px]">Mínimo Vidas</span>
                                      <span className="text-white text-sm">{item.pricingRule.minEmployees}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            
            {processedResults.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-24 text-center text-slate-600">
                  <div className="flex flex-col items-center justify-center opacity-50 hover:opacity-100 transition-opacity">
                    <svg className="w-16 h-16 mb-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <p className="text-sm tracking-wide font-light">Nenhum resultado encontrado.</p>
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