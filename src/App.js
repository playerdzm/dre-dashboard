import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ReferenceLine } from 'recharts';
import { BarChart2, DollarSign, TrendingUp, Percent, Target, Briefcase, ShoppingCart, Users, CreditCard, FileText, Lightbulb, User, Building, CalendarDays, Save, PlusCircle, Trash2, LogIn, Edit3, XCircle, Menu, Settings, HelpCircle, FilePieChart, BarChartHorizontal, Archive, ChevronsRight } from 'lucide-react';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, Timestamp, orderBy, serverTimestamp, runTransaction, getDocs } from 'firebase/firestore';
import { setLogLevel } from 'firebase/app';

// Variáveis Globais do Ambiente
const firebaseConfig = {
  apiKey: "AIzaSyBu8bPCkcEH5VQBDFFQGnnJTxYu9Ol6F1E",
  authDomain: "dre-dashboard-667b0.firebaseapp.com",
  projectId: "dre-dashboard-667b0",
  storageBucket: "dre-dashboard-667b0.appspot.com",
  messagingSenderId: "27620391126",
  appId: "1:27620391126:web:27ea60d4e9464077517177"
};
const appId = "1:27620391126:web:27ea60d4e9464077517177";
const initialAuthToken = undefined;

// Inicialização do Firebase
let fbApp;
if (!getApps().length) {
  fbApp = initializeApp(firebaseConfig);
} else {
  fbApp = getApp();
}
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
setLogLevel('debug');

// Constantes da V4 Company
const V4_RED = '#ED1C24';
const V4_TEXT_LOGO = 'V4 COMPANY';
const CHART_COLORS = ['#ED1C24', '#4A5568', '#718096', '#A0AEC0', '#F56565', '#4299E1', '#F6E05E', '#68D391', '#ED8936', '#9F7AEA', '#38B2AC', '#ECC94B', '#0BC5EA'];


// --- Helpers ---
function debounce(func, wait) {
    let timeout;
    let latestArgs;
    const debounced = (...args) => {
        latestArgs = args;
        clearTimeout(timeout);
        timeout = setTimeout(() => { if (latestArgs) { func(...latestArgs); } }, wait);
    };
    debounced.flush = () => { clearTimeout(timeout); if (latestArgs) { func(...latestArgs); latestArgs = null; } };
    debounced.cancel = () => { clearTimeout(timeout); latestArgs = null; }
    return debounced;
}
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const parseToNumber = (value) => {
  if (value === '' || value === null || value === undefined) return NaN;
  const parsed = parseFloat(String(value).replace(',', '.'));
  return isNaN(parsed) ? 0 : parsed;
};

// --- Componentes UI reutilizáveis ---
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity duration-300" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-5 sm:p-6 max-w-lg w-full transform transition-all duration-300 scale-95" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
                    {onClose && <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400">
                        <XCircle size={24} />
                    </button>}
                </div>
                <div>{children}</div>
            </div>
        </div>
    );
};

const NoClientSelected = ({ onNavigate, pageTitle = "a página" }) => (
    <div className="text-center text-gray-500 mt-10 p-6 bg-white rounded-lg shadow max-w-lg mx-auto">
        <Users size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-xl font-semibold text-gray-700">Nenhum cliente selecionado</p>
        <p className="mt-2">
            Por favor, selecione um cliente para visualizar {pageTitle}.
        </p>
        <Button onClick={onNavigate} variant="primary" className="mt-6 mx-auto">
            Ir para Clientes
        </Button>
    </div>
);

const InputField = ({ label, value, onChange, type = 'number', placeholder, unit, name, info, disabled = false }) => (
  <div className="mb-4">
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
      {label} {info && <span title={info} className="text-blue-500 cursor-help">(?)</span>}
    </label>
    <div className="mt-1 relative rounded-md shadow-sm">
      {unit === 'R$' && <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center"><span className="text-gray-500 sm:text-sm">R$</span></div>}
      <input type={type} name={name} id={name} value={value === null || value === undefined ? '' : value} onChange={onChange} placeholder={placeholder || (type === 'number' ? "0" : "")}
        className={`block w-full pr-10 sm:text-sm border-gray-300 rounded-md focus:ring-v4-red focus:border-v4-red ${unit === 'R$' ? 'pl-10' : 'pl-3'} ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        min={type === 'number' && !name.toLowerCase().includes('perc') ? "0" : undefined}
        step={type === 'number' ? "0.01" : undefined}
        disabled={disabled} />
      {unit === '%' && <div className="pointer-events-none absolute inset-y-0 right-0 pr-3 flex items-center"><span className="text-gray-500 sm:text-sm">%</span></div>}
    </div>
  </div>
);

const CalculatedField = ({ label, value, isPercentage = false, isCurrency = true, info }) => {
  let displayValue = value;
  if (typeof value === 'number' && isFinite(value)) {
    if (isCurrency) displayValue = value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    else if (isPercentage) displayValue = `${value.toFixed(2)}%`;
    else displayValue = value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  } else { displayValue = isCurrency ? (0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : (isPercentage ? '0.00%' : '0'); }
  return (
    <div className="mb-2 p-3 bg-gray-50 rounded-md shadow-sm">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">{label} {info && <span title={info} className="text-blue-500 cursor-help">(?)</span>}</span>
        <span className={`text-sm font-semibold ${typeof value === 'number' && value < 0 ? 'text-red-600' : `text-v4-red`}`}>{displayValue}</span>
      </div>
    </div>);
};

const DashboardCard = ({ title, value, icon, isPercentage = false, isCurrency = true, info }) => {
  let displayValue = value;
  if (typeof value === 'number' && isFinite(value)) {
    if (isCurrency) displayValue = value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    else if (isPercentage) displayValue = `${value.toFixed(2)}%`;
    else displayValue = value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  } else { displayValue = isCurrency ? (0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : (isPercentage ? '0.00%' : '0'); }
  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg min-h-[100px] sm:min-h-[120px] flex flex-col justify-between">
      <div>
        <div className="flex items-center mb-1"><div className={`text-v4-red`}>{icon}</div><h3 className="text-sm sm:text-md font-semibold text-gray-700 ml-2">{title}</h3></div>
        {info && <p className="text-xs text-gray-500 mb-1">{info}</p>}
      </div>
      <p className={`text-xl sm:text-2xl font-bold ${typeof value === 'number' && value < 0 ? 'text-red-500' : `text-v4-red`}`}>{displayValue}</p>
    </div>);
};

const Button = ({ onClick, children, variant = 'primary', className = '', type = 'button', disabled = false, id }) => {
  const baseStyle = "px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center";
  const variantStyles = {
    primary: `bg-v4-red text-white hover:bg-red-700 focus:ring-v4-red`,
    secondary: "bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400",
    danger: "bg-red-500 text-white hover:bg-red-600 focus:ring-red-400",
    outline: `border border-v4-red text-v4-red hover:bg-red-50 focus:ring-v4-red`
  };
  return (<button type={type} id={id} onClick={onClick} className={`${baseStyle} ${variantStyles[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`} disabled={disabled}>{children}</button>);
};

// --- Componentes de Gráficos ---
const MonthlyRevenueChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md min-h-[350px] flex flex-col items-center justify-center text-center">
        <BarChart2 size={48} className="text-gray-300 mb-4"/>
        <p className="text-gray-600 font-semibold text-lg">Faturamento Mensal vs Lucro Líquido</p>
        <p className="text-sm text-gray-400 mt-2">Nenhum dado encontrado para este ano.</p>
      </div>
    );
  }

  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const chartData = data.map(item => ({
    ...item,
    name: monthNames[parseInt(item.month, 10) - 1]
  })).sort((a, b) => parseInt(a.month) - parseInt(b.month));

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md min-h-[350px]">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Faturamento Mensal vs Lucro Líquido</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{fontSize: 12}} />
          <YAxis tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`} tick={{fontSize: 12}} />
          <Tooltip formatter={(value, name) => [formatCurrency(value), name]} cursor={{ fill: 'rgba(237, 28, 36, 0.1)' }}/>
          <Legend />
          <Bar dataKey="faturamento" fill={V4_RED} name="Faturamento Bruto" barSize={25} />
          <Bar dataKey="lucroLiquido" fill="#4A5568" name="Lucro Líquido" barSize={25} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const RevenueVsExpensesChart = ({ data }) => {
    const chartData = [{
        name: 'Comparativo',
        Receita: data?.faturamentoTotal > 0 ? data.faturamentoTotal : 0,
        Despesa: data?.totalCV > 0 || data?.totalCustosFixosMensais > 0 ? (data.totalCV + data.totalCustosFixosMensais) : 0,
    }];
    
    const hasData = chartData[0].Receita > 0 || chartData[0].Despesa > 0;

    return (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md min-h-[350px]">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Receita vs. Despesas Totais</h3>
           {hasData ? (
             <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`} tick={{fontSize: 12}}/>
                    <YAxis type="category" dataKey="name" hide />
                    <Tooltip formatter={(value) => formatCurrency(value)} cursor={{ fill: 'rgba(237, 28, 36, 0.1)' }}/>
                    <Legend wrapperStyle={{paddingTop: '20px'}}/>
                    <Bar dataKey="Receita" fill={V4_RED} name="Receita Bruta" barSize={40}/>
                    <Bar dataKey="Despesa" fill="#718096" name="Despesa Total" barSize={40}/>
                </BarChart>
            </ResponsiveContainer>
           ) : (
            <div className="h-[300px] flex flex-col items-center justify-center text-center">
                <BarChartHorizontal size={48} className="text-gray-300 mb-4"/>
                <p className="text-gray-500">Sem dados para exibir.</p>
            </div>
           )}
        </div>
    );
};

const ExpensesPieChart = ({ data, assumptions, dreInputs }) => {
    const { results } = data;

    const pieData = [
      // Custos Variaveis (das premissas)
      { name: 'Frete', value: results?.freteTotal || 0 },
      { name: 'Imposto p/ Venda', value: results?.impostoTotal || 0 },
      { name: 'Matéria Prima', value: results?.materiaPrimaTotal || 0 },
      { name: 'Gateway/Tx App', value: results?.gatewayTotal || 0 },
      { name: 'Outros CV', value: results?.outrosCVTotal || 0 },
      
      // Custos de Marketing e Investimentos
      { name: 'Taxa V4 Company', value: parseToNumber(assumptions?.txV4Company) || 0 },
      { name: 'Invest. em Mídia Paga', value: parseToNumber(dreInputs?.trafegoPago) || 0 },
      { name: 'Investimentos (Capex)', value: parseToNumber(dreInputs?.capex) || 0 },

      // Custos Fixos (do DRE)
      { name: 'Aluguel', value: parseToNumber(dreInputs?.aluguel) || 0 },
      { name: 'Condomínio', value: parseToNumber(dreInputs?.condominio) || 0 },
      { name: 'IPTU', value: parseToNumber(dreInputs?.iptu) || 0 },
      { name: 'Água', value: parseToNumber(dreInputs?.agua) || 0 },
      { name: 'Luz', value: parseToNumber(dreInputs?.luz) || 0 },
      { name: 'Telefone/Internet', value: parseToNumber(dreInputs?.telefoneInternet) || 0 },
      { name: 'Software Gestão', value: parseToNumber(dreInputs?.softwareGestao) || 0 },
      { name: 'Contabilidade', value: parseToNumber(dreInputs?.contabilidade) || 0 },
      { name: 'Pró-labore', value: parseToNumber(dreInputs?.proLabore) || 0 },
      { name: 'Salários', value: parseToNumber(dreInputs?.salarios) || 0 },
      { name: 'Encargos', value: parseToNumber(dreInputs?.encargos) || 0 },
      { name: 'Benefícios', value: parseToNumber(dreInputs?.beneficios) || 0 },
      { name: 'Outros CF', value: parseToNumber(dreInputs?.outrosCustosFixos) || 0 },
    ].filter(item => item.value > 0);
    
    return (
       <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md min-h-[350px]">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Composição Detalhada das Despesas</h3>
            {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} labelLine={false}>
                            {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend iconSize={10} layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{fontSize: "12px", lineHeight: "1.5em", overflowY: 'auto', maxHeight: '280px'}}/>
                    </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-center">
                    <FilePieChart size={48} className="text-gray-300 mb-4"/>
                    <p className="text-gray-500">Sem dados de despesas para exibir.</p>
                </div>
            )}
        </div>
    );
};


// --- Estruturas de Dados Iniciais ---
const initialDreInputs = {
  ifoodPedidos: '', ifoodTicketMedio: '', ifoodValorVendas: '', sitePedidos: '', siteTicketMedio: '', siteValorVendas: '', salaoPedidos: '', salaoTicketMedio: '', salaoValorVendas: '', trafegoPago: '', aluguel: '', condominio: '', iptu: '', agua: '', luz: '', telefoneInternet: '', softwareGestao: '', contabilidade: '', proLabore: '', salarios: '', encargos: '', beneficios: '', outrosCustosFixos: '', capex: '', taxaConversaoIfood: '', taxaConversaoSiteProprio: '',
};
const initialAssumptions = {
  fretePorVenda: '', impostoPorVenda: '', materiaPrimaPorVenda: '', gatewayPorVenda: '', outrosCustosVariaveisPorVenda: '', txV4Company: '',
};

// --- Funções de Cálculo ---
const calculateDreResults = (dreInputs, assumptions) => {
    const parsedDreInputs = Object.keys(dreInputs).reduce((acc, key) => { acc[key] = parseToNumber(dreInputs[key]); return acc; }, {});
    const parsedAssumptions = Object.keys(assumptions).reduce((acc, key) => { acc[key] = parseToNumber(assumptions[key]); return acc; }, {});
    const { ifoodPedidos, ifoodValorVendas, sitePedidos, siteValorVendas, salaoPedidos, salaoValorVendas, trafegoPago, aluguel, condominio, iptu, agua, luz, telefoneInternet, softwareGestao, contabilidade, proLabore, salarios, encargos, beneficios, outrosCustosFixos, capex } = parsedDreInputs;
    const { fretePorVenda, impostoPorVenda, materiaPrimaPorVenda, gatewayPorVenda, outrosCustosVariaveisPorVenda, txV4Company } = parsedAssumptions;
    const faturamentoTotal = (ifoodValorVendas || 0) + (siteValorVendas || 0) + (salaoValorVendas || 0);
    const totalPedidosValidos = (ifoodPedidos || 0) + (sitePedidos || 0) + (salaoPedidos || 0);
    const freteTotal = (fretePorVenda || 0) * totalPedidosValidos;
    const impostoTotal = (impostoPorVenda || 0) * totalPedidosValidos;
    const materiaPrimaTotal = (materiaPrimaPorVenda || 0) * totalPedidosValidos;
    const gatewayTotal = (gatewayPorVenda || 0) * totalPedidosValidos;
    const outrosCVTotal = (outrosCustosVariaveisPorVenda || 0) * totalPedidosValidos;
    const totalCV = freteTotal + impostoTotal + materiaPrimaTotal + gatewayTotal + outrosCVTotal;
    const receitaLiquida = faturamentoTotal;
    const margemContribuicaoValor = receitaLiquida - totalCV;
    const margemContribuicaoPerc = faturamentoTotal !== 0 ? (margemContribuicaoValor / faturamentoTotal) * 100 : 0;
    const cfMensais = (aluguel||0)+(condominio||0)+(iptu||0)+(agua||0)+(luz||0)+(telefoneInternet||0)+(softwareGestao||0)+(contabilidade||0)+(proLabore||0)+(salarios||0)+(encargos||0)+(beneficios||0)+(outrosCustosFixos||0);
    const totalCustosFixosMensais = cfMensais + (txV4Company||0) + (trafegoPago||0);
    const resultadoOperacionalValor = margemContribuicaoValor - totalCustosFixosMensais;
    const resultadoOperacionalPerc = faturamentoTotal !== 0 ? (resultadoOperacionalValor / faturamentoTotal) * 100 : 0;
    const totalInvestimentos = capex || 0;
    const resultadoLiquidoValor = resultadoOperacionalValor - totalInvestimentos;
    const resultadoLiquidoPerc = faturamentoTotal !== 0 ? (resultadoLiquidoValor / faturamentoTotal) * 100 : 0;
    const pontoEquilibrioValor = margemContribuicaoPerc !== 0 ? totalCustosFixosMensais / (margemContribuicaoPerc / 100) : 0;
    const ticketMedioTotalCalculado = totalPedidosValidos > 0 ? faturamentoTotal / totalPedidosValidos : 0;
    const pontoEquilibrioPedidos = ticketMedioTotalCalculado > 0 ? pontoEquilibrioValor / ticketMedioTotalCalculado : 0;
    const denominadorCac = (ifoodPedidos || 0) + (sitePedidos || 0);
    const cac = denominadorCac > 0 && trafegoPago > 0 ? trafegoPago / denominadorCac : 0;
    const custoTotalMarketing = (txV4Company||0) + (trafegoPago||0);
    const roiMarketing = custoTotalMarketing !== 0 ? ((margemContribuicaoValor - custoTotalMarketing) / custoTotalMarketing) * 100 : 0;
    const roasTrafegoPago = trafegoPago !== 0 ? ((ifoodValorVendas||0)+(siteValorVendas||0)) / trafegoPago : 0;
    return {
        faturamentoIfood: ifoodValorVendas||0, faturamentoSite: siteValorVendas||0, faturamentoSalao: salaoValorVendas||0, faturamentoTotal, receitaLiquida, freteTotal, impostoTotal, materiaPrimaTotal, gatewayTotal, outrosCVTotal, totalCV, margemContribuicaoValor, margemContribuicaoPerc, totalCustosFixosMensais, txV4Company: (txV4Company||0), resultadoOperacionalValor, resultadoOperacionalPerc, totalInvestimentos, resultadoLiquidoValor, resultadoLiquidoPerc, pontoEquilibrioValor, pontoEquilibrioPedidos, ticketMedioTotal: ticketMedioTotalCalculado, cac, roiMarketing, roasTrafegoPago, taxaConversaoIfood: parsedDreInputs.taxaConversaoIfood, taxaConversaoSiteProprio: parsedDreInputs.taxaConversaoSiteProprio, trafegoPagoDisplay: (trafegoPago||0)
    };
}


// --- Componente DreCalculator ---
const DreCalculator = ({ dreInputs, assumptions, onDreInputChange, disabled, viewMode = 'full', monthlyData, isExporting }) => {
  const [results, setResults] = useState({});
  const [activeSection, setActiveSection] = useState('faturamentoCanais');
  
  useEffect(() => {
    const newResults = calculateDreResults(dreInputs, assumptions);
    setResults(newResults);
  }, [dreInputs, assumptions]);

  const inputLayoutConfig = useMemo(() => [
    { id: 'faturamentoCanais', title: 'Faturamento por Canal', icon: <ShoppingCart />, channels: [ { name: 'iFood', prefix: 'ifood', fields: [ { name: 'ifoodPedidos', label: 'Nº Pedidos', type: 'number'}, { name: 'ifoodTicketMedio', label: 'Ticket Médio', unit: 'R$', type: 'number'}, { name: 'ifoodValorVendas', label: 'Valor Vendas', unit: 'R$', type: 'number'}, ]}, { name: 'Site Próprio', prefix: 'site', fields: [ { name: 'sitePedidos', label: 'Nº Pedidos', type: 'number'}, { name: 'siteTicketMedio', label: 'Ticket Médio', unit: 'R$', type: 'number'}, { name: 'siteValorVendas', label: 'Valor Vendas', unit: 'R$', type: 'number'}, ]}, { name: 'Salão', prefix: 'salao', fields: [ { name: 'salaoPedidos', label: 'Nº Pedidos', type: 'number'}, { name: 'salaoTicketMedio', label: 'Ticket Médio', unit: 'R$', type: 'number'}, { name: 'salaoValorVendas', label: 'Valor Vendas', unit: 'R$', type: 'number'}, ]}, ]}, { id: 'investimentoAds', title: 'Investimento em Mídia', icon: <TrendingUp/>, fields: [ { name: 'trafegoPago', label: 'Tráfego Pago (Ads)', unit: 'R$'} ]}, { id: 'custosFixosMensais', title: 'Outros Custos Fixos Mensais', icon: <Briefcase />, fields: [ { name: 'aluguel', label: 'Aluguel', unit: 'R$'}, { name: 'condominio', label: 'Condomínio', unit: 'R$'}, { name: 'iptu', label: 'IPTU', unit: 'R$'}, { name: 'agua', label: 'Água', unit: 'R$'}, { name: 'luz', label: 'Luz', unit: 'R$'}, { name: 'telefoneInternet', label: 'Telefone/Internet', unit: 'R$'}, { name: 'softwareGestao', label: 'Software Gestão', unit: 'R$'}, { name: 'contabilidade', label: 'Contabilidade', unit: 'R$'}, { name: 'proLabore', label: 'Pró-labore', unit: 'R$'}, { name: 'salarios', label: 'Salários', unit: 'R$'}, { name: 'encargos', label: 'Encargos', unit: 'R$'}, { name: 'beneficios', label: 'Benefícios', unit: 'R$'}, { name: 'outrosCustosFixos', label: 'Outros Custos Fixos Diversos', unit: 'R$'}, ]}, { id: 'investimentosMensais', title: 'Investimentos (Capex Mensal)', icon: <TrendingUp />, fields: [ { name: 'capex', label: 'Capex do Mês', unit: 'R$', info: 'Investimentos em bens duráveis no mês.'}, ]}, { id: 'metricasConversao', title: 'Métricas de Conversão (Referência)', icon: <Lightbulb />, fields: [ { name: 'taxaConversaoIfood', label: 'Tx. Conversão Ifood', unit: '%', info: '% visitantes Ifood -> pedido.'}, { name: 'taxaConversaoSiteProprio', label: 'Tx. Conversão Site', unit: '%', info: '% visitantes site -> pedido.'}, ]},
  ], []);

  return ( <div className="w-full"> <section id="kpi-cards" className="mb-8"> <h2 className="text-xl font-semibold text-gray-800 mb-4">Principais Indicadores</h2> <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6"> <DashboardCard title="Receita Bruta Total" value={results.faturamentoTotal} icon={<DollarSign size={20} />} /> <DashboardCard title="Lucro Operacional" value={results.resultadoOperacionalValor} icon={<TrendingUp size={20} />} /> <DashboardCard title="Lucro Líquido" value={results.resultadoLiquidoValor} icon={<TrendingUp size={20} />} /> <DashboardCard title="Margem de Lucro (%)" value={results.resultadoLiquidoPerc} icon={<Percent size={20} />} isPercentage={true} isCurrency={false} /> </div> </section> {viewMode === 'full' && ( <div className="lg:flex lg:space-x-8"> <div className="lg:w-2/5 xl:w-1/3"> <h3 className="text-lg font-semibold text-gray-700 mb-4">Entrada de Dados Mensais</h3> {inputLayoutConfig.map(section => ( <div key={section.id} className="mb-6 bg-white rounded-lg shadow-md overflow-hidden"> <button onClick={() => !isExporting && setActiveSection(activeSection === section.id ? null : section.id)} className={`w-full text-left text-md sm:text-lg font-semibold text-gray-700 p-3 sm:p-4 flex items-center justify-between hover:bg-gray-100 focus:outline-none ${activeSection === section.id || isExporting ? 'rounded-t-lg' : 'rounded-lg'}`}> <div className="flex items-center">{React.cloneElement(section.icon, {className: `mr-2 text-v4-red`, size:18})} {section.title}</div> <span className={`transform transition-transform duration-200 ${activeSection === section.id || isExporting ? 'rotate-180' : 'rotate-0'}`}>▼</span> </button> {(activeSection === section.id || isExporting) && ( <div className={`p-3 sm:p-4 border-t border-gray-200 ${section.channels ? 'space-y-4' : 'grid grid-cols-1 sm:grid-cols-2 gap-x-4'}`}> {section.channels ? section.channels.map(channel => ( <div key={channel.prefix} className="p-3 border rounded-md"> <p className="text-md font-medium text-gray-600 mb-2">{channel.name}</p> {channel.fields.map(field => ( <InputField key={field.name} {...field} value={dreInputs[field.name]} onChange={onDreInputChange} disabled={disabled} /> ))} </div> )) : section.fields.map(field => <InputField key={field.name} {...field} value={dreInputs[field.name]} onChange={onDreInputChange} disabled={disabled} />)} </div> )} </div> ))} </div> <div className="lg:w-3/5 xl:w-2/3 mt-8 lg:mt-0"> <h3 className="text-lg font-semibold text-gray-700 mb-4">Resultados Calculados Detalhados</h3> <div className="bg-white p-3 sm:p-4 rounded-lg shadow-md space-y-2 sm:space-y-3"> <h4 className="text-md font-semibold text-gray-700 flex items-center"><DollarSign className="mr-2 text-v4-red" size={18}/>Receitas</h4> <CalculatedField label="Fat. Ifood" value={results.faturamentoIfood} /> <CalculatedField label="Fat. Site" value={results.faturamentoSite} /> <CalculatedField label="Fat. Salão" value={results.faturamentoSalao} /> <CalculatedField label="FATURAMENTO TOTAL (RECEITA BRUTA)" value={results.faturamentoTotal} /> <hr className="my-3"/> <CalculatedField label="RECEITA LÍQUIDA" value={results.receitaLiquida} /> <hr className="my-3"/> <h4 className="text-md font-semibold text-gray-700 flex items-center"><ShoppingCart className="mr-2 text-v4-red" size={18}/>Custos Variáveis (Baseado nas Premissas)</h4> <CalculatedField label="Frete Total" value={results.freteTotal} /> <CalculatedField label="Imposto por Venda (Total)" value={results.impostoTotal} /> <CalculatedField label="Matéria Prima/CMV (Total)" value={results.materiaPrimaTotal} /> <CalculatedField label="Gateway/Tx App (Total)" value={results.gatewayTotal} /> <CalculatedField label="Outros Custos Variáveis (Total)" value={results.outrosCVTotal} /> <CalculatedField label="TOTAL CUSTOS VARIÁVEIS (CV)" value={results.totalCV} /> <hr className="my-3"/> <h4 className="text-md font-semibold text-gray-700 flex items-center"><Target className="mr-2 text-v4-red" size={18}/>Margem de Contribuição</h4> <CalculatedField label="MARGEM DE CONTRIBUIÇÃO (R$)" value={results.margemContribuicaoValor} /> <CalculatedField label="MARGEM DE CONTRIBUIÇÃO (%)" value={results.margemContribuicaoPerc} isPercentage={true} isCurrency={false} info="Sobre Receita Bruta"/> <hr className="my-3"/> <h4 className="text-md font-semibold text-gray-700 flex items-center"><Briefcase className="mr-2 text-v4-red" size={18}/>Custos Fixos</h4> <CalculatedField label="Taxa V4 Company (Premissa)" value={results.txV4Company} /> <CalculatedField label="Investimento em Tráfego Pago" value={results.trafegoPagoDisplay} /> <CalculatedField label="TOTAL CUSTOS FIXOS (com Tx V4 e Tráfego)" value={results.totalCustosFixosMensais} /> <hr className="my-3"/> <h4 className="text-md font-semibold text-gray-700 flex items-center"><TrendingUp className="mr-2 text-v4-red" size={18}/>Resultados</h4> <CalculatedField label="R. OPERACIONAL (R$)" value={results.resultadoOperacionalValor} /> <CalculatedField label="R. OPERACIONAL (%)" value={results.resultadoOperacionalPerc} isPercentage={true} isCurrency={false} info="Sobre Receita Bruta"/> <CalculatedField label="Investimentos (Capex)" value={results.totalInvestimentos} /> <CalculatedField label="RESULTADO LÍQUIDO (R$)" value={results.resultadoLiquidoValor} /> <CalculatedField label="LUCRATIVIDADE (%)" value={results.resultadoLiquidoPerc} isPercentage={true} isCurrency={false} info="Sobre Receita Bruta"/> <hr className="my-3"/> <h4 className="text-md font-semibold text-gray-700 flex items-center"><FileText className="mr-2 text-v4-red" size={18}/>Outras Métricas</h4> <CalculatedField label="P. Equilíbrio (R$)" value={results.pontoEquilibrioValor} /> <CalculatedField label="P. Equilíbrio (Pedidos)" value={results.pontoEquilibrioPedidos} isCurrency={false} /> <CalculatedField label="Ticket Médio Total" value={results.ticketMedioTotal} /> <CalculatedField label="Tx. Conv. Ifood (Input)" value={results.taxaConversaoIfood} isPercentage={true} isCurrency={false}/> <CalculatedField label="Tx. Conv. Site (Input)" value={results.taxaConversaoSiteProprio} isPercentage={true} isCurrency={false}/> <CalculatedField label="CAC" value={results.cac} /> <CalculatedField label="ROI Marketing" value={results.roiMarketing} isPercentage={true} isCurrency={false}/> <CalculatedField label="ROAS Tráfego" value={results.roasTrafegoPago} isCurrency={false}/> </div> </div> </div> )} {viewMode === 'dashboardOnly' && ( <section id="charts-and-graphs" className="mt-8"> <h2 className="text-xl font-semibold text-gray-800 mb-6">Análises Gráficas</h2> <div className="grid grid-cols-1 gap-6"> <div className="mb-6"> <MonthlyRevenueChart data={monthlyData} /> </div> <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> <RevenueVsExpensesChart data={results} /> <ExpensesPieChart data={{ results }} assumptions={assumptions} dreInputs={dreInputs}/> </div> </div> </section> )} </div>);};

// --- Componente AssumptionsPage ---
const AssumptionsPage = ({ userId, selectedClientId, selectedClientName, clients, onClientChange, openModal, setCurrentPage }) => {
  const [assumptions, setAssumptions] = useState(initialAssumptions);
  const [isLoading, setIsLoading] = useState(false); const [isSaving, setIsSaving] = useState(false); const [error, setError] = useState('');
  const assumptionDocPath = useMemo(() => { if (!userId || !selectedClientId) return null; return `artifacts/${appId}/users/${userId}/clients/${selectedClientId}/assumptions/current`; }, [userId, selectedClientId]);
  useEffect(() => { if (!assumptionDocPath) { setAssumptions(initialAssumptions); return; } setIsLoading(true); const unsub = onSnapshot(doc(db, assumptionDocPath), (docSnap) => { if (docSnap.exists()) { setAssumptions({ ...initialAssumptions, ...docSnap.data() }); } else { setAssumptions(initialAssumptions); } setIsLoading(false); }, (err) => { console.error("Erro premissas:", err); setError("Falha premissas."); setIsLoading(false); }); return () => unsub(); }, [assumptionDocPath]);
  const handleAssumptionChange = (e) => { const { name, value } = e.target; setAssumptions(prev => ({ ...prev, [name]: value })); };
  const handleSaveAssumptions = async () => { if (!assumptionDocPath) { setError("Selecione um cliente."); return; } setIsSaving(true); setError(''); try { const dataToSave = Object.keys(assumptions).reduce((acc, key) => { const val = assumptions[key]; if (val === '' || val === null || val === undefined) acc[key] = ''; else { const numVal = parseFloat(String(val).replace(',', '.')); acc[key] = isNaN(numVal) ? val : numVal; } return acc; }, {}); await setDoc(doc(db, assumptionDocPath), dataToSave, { merge: true }); openModal("Sucesso", "Premissas foram salvas com sucesso!"); } catch (err) { console.error("Erro salvar premissas:", err); setError("Falha salvar premissas."); openModal("Erro", "Ocorreu uma falha ao salvar as premissas."); } finally { setIsSaving(false); } };
  const assumptionFields = [ { name: 'fretePorVenda', label: 'Frete por Venda', unit: 'R$', info: 'Custo médio de frete por cada venda/pedido.' }, { name: 'impostoPorVenda', label: 'Imposto por Venda (Fixo)', unit: 'R$', info: 'Valor fixo de imposto por venda (Ex: ICMS ST, etc.).' }, { name: 'materiaPrimaPorVenda', label: 'Matéria Prima/CMV por Venda', unit: 'R$', info: 'Custo dos insumos/produtos por cada venda.' }, { name: 'gatewayPorVenda', label: 'Gateway/Tx. Marketplace por Venda', unit: 'R$', info: 'Taxa da plataforma de venda ou processador de pagamento por venda.' }, { name: 'outrosCustosVariaveisPorVenda', label: 'Outros Custos Variáveis por Venda', unit: 'R$', info: 'Outros custos diretos que variam com cada venda.' }, { name: 'txV4Company', label: 'Taxa Fixa V4 Company', unit: 'R$', info: 'Fee mensal da assessoria V4 Company (custo fixo).' }, ];
  
  if (!userId) return <p className="text-center mt-10">Login necessário.</p>;

  return ( <div className="max-w-3xl mx-auto mt-2 p-4 sm:p-6 bg-white rounded-lg shadow-md"> <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center"><Archive className="mr-2 text-v4-red" />Premissas do Cliente</h2> <div className="mb-6"> <label htmlFor="clientSelectAssumptions" className="block text-sm font-medium text-gray-700 mb-1">Selecione o Cliente</label> <select id="clientSelectAssumptions" value={selectedClientId} onChange={onClientChange} className="block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-v4-red focus:border-v4-red sm:text-sm"> <option value="">-- Selecione --</option> {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)} </select> </div> {selectedClientId ? ( isLoading ? <p>Carregando premissas...</p> : <> {error && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4">{error}</p>} <p className="mb-4 text-gray-600">Defina os valores base para <strong className="text-gray-800">{selectedClientName}</strong>.</p> <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2"> {assumptionFields.map(field => ( <InputField key={field.name} {...field} value={assumptions[field.name]} onChange={handleAssumptionChange} /> ))} </div> <Button id="saveAssumptionsButton" onClick={handleSaveAssumptions} disabled={isSaving || isLoading} className="mt-6 w-full md:w-auto"> {isSaving ? <><Lightbulb size={18} className="mr-2 animate-spin"/> Salvando...</> : <><Save size={18} className="mr-2"/> Salvar Premissas</>} </Button> </> ) : ( <NoClientSelected onNavigate={() => setCurrentPage('clients')} pageTitle="as Premissas"/> )} </div>);};

// --- Componente ClientsPage ---
const ClientsPage = ({ userId, onClientSelect, openModal, closeModal }) => {
  const [clients, setClients] = useState([]); const [newClientName, setNewClientName] = useState(''); const [editingClient, setEditingClient] = useState(null); const [isLoading, setIsLoading] = useState(true); const [error, setError] = useState('');
  const clientsCollectionPath = `artifacts/${appId}/users/${userId}/clients`;
  useEffect(() => { if (!userId) { setIsLoading(false); setClients([]); return; } setIsLoading(true); const q = query(collection(db, clientsCollectionPath), orderBy("createdAt", "desc")); const unsub = onSnapshot(q, (snap) => { setClients(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setIsLoading(false); }, (err) => { console.error("Erro clientes:", err); setError("Não foi possível carregar."); setIsLoading(false); }); return () => unsub(); }, [userId, clientsCollectionPath]);
  const handleAddClient = async (e) => { e.preventDefault(); if (!newClientName.trim() || !userId) return; try { await addDoc(collection(db, clientsCollectionPath), { name: newClientName.trim(), createdAt: serverTimestamp() }); setNewClientName(''); setError(''); } catch (err) { console.error("Erro add cliente:", err); setError("Falha ao adicionar."); } };
  const handleUpdateClient = async (e) => { e.preventDefault(); if (!editingClient || !editingClient.name.trim() || !userId) return; try { await updateDoc(doc(db, clientsCollectionPath, editingClient.id), { name: editingClient.name.trim() }); setEditingClient(null); setError(''); } catch (err) { console.error("Erro atualizar cliente:", err); setError("Falha ao atualizar."); } };
  const confirmDeleteClient = (client) => { openModal( "Confirmar Exclusão", <div> <p className="mb-6 text-gray-600">Tem certeza que deseja excluir o cliente "{client.name}"? Todas as suas premissas e DREs serão perdidos. Esta ação é irreversível.</p> <div className="flex justify-end space-x-3"> <Button variant="secondary" onClick={closeModal}>Cancelar</Button> <Button variant="danger" onClick={() => performDelete(client.id)}>Excluir</Button> </div> </div> ); };
  const performDelete = async (clientId) => { closeModal(); try { await runTransaction(db, async (transaction) => { const clientDocRef = doc(db, clientsCollectionPath, clientId); const dresQuery = query(collection(db, `artifacts/${appId}/users/${userId}/dres`), where("clientId", "==", clientId)); const dresSnap = await getDocs(dresQuery); dresSnap.forEach(dreDoc => transaction.delete(dreDoc.ref)); const assumptionDocRef = doc(db, `artifacts/${appId}/users/${userId}/clients/${clientId}/assumptions/current`); transaction.delete(assumptionDocRef); transaction.delete(clientDocRef); }); setError(''); } catch (err) { console.error("Erro excluir cliente:", err); setError("Falha ao excluir o cliente."); } };
  if (!userId) return <p className="text-center mt-10">Login necessário.</p>; if (isLoading) return <p className="text-center mt-10">Carregando...</p>;
  return ( <div className="max-w-3xl mx-auto mt-2 p-4 sm:p-6 bg-white rounded-lg shadow-md"> <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center"><Building className="mr-2 text-v4-red" />Gerenciar Clientes</h2> {error && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4">{error}</p>} <form onSubmit={editingClient ? handleUpdateClient : handleAddClient} className="mb-8 p-4 border rounded-md"> <h3 className="text-lg font-medium mb-3">{editingClient ? "Editar" : "Adicionar Novo"}</h3> <InputField name="clientName" label="Nome da Empresa Cliente" type="text" value={editingClient ? editingClient.name : newClientName} onChange={(e) => editingClient ? setEditingClient({...editingClient, name: e.target.value}) : setNewClientName(e.target.value)} placeholder="Ex: Burger King" /> <div className="flex items-center space-x-2 mt-4"> <Button type="submit" variant="primary" disabled={editingClient ? !editingClient.name.trim() : !newClientName.trim()}>{editingClient ? <><Save size={18} className="mr-1"/> Salvar</> : <><PlusCircle size={18} className="mr-1"/> Adicionar</>}</Button> {editingClient && (<Button type="button" variant="secondary" onClick={() => setEditingClient(null)}><XCircle size={18} className="mr-1"/> Cancelar</Button>)} </div> </form> <h3 className="text-xl font-semibold mb-4">Meus Clientes</h3> {clients.length === 0 ? (<p className="text-gray-500">Nenhum cliente.</p>) : ( <ul className="space-y-3"> {clients.map(client => ( <li key={client.id} className="p-4 bg-gray-50 rounded-md shadow-sm flex flex-col sm:flex-row justify-between items-center hover:bg-gray-100"> <div className='w-full sm:w-auto text-center sm:text-left mb-4 sm:mb-0'> <p className="font-medium">{client.name}</p> {client.createdAt?.seconds && (<p className="text-xs text-gray-500">Desde: {new Date(client.createdAt.seconds * 1000).toLocaleDateString('pt-BR')}</p>)} </div> <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2"> <Button variant="outline" className="p-2 text-sm" onClick={() => onClientSelect(client.id, 'assumptions')} title="Premissas"><Archive size={16} className="mr-1"/> Premissas</Button> <Button variant="outline" className="p-2 text-sm" onClick={() => onClientSelect(client.id, 'dashboard')} title="DREs"><BarChart2 size={16} className="mr-1"/> DREs</Button> <Button variant="secondary" className="p-2" onClick={() => setEditingClient({id: client.id, name: client.name})} title="Editar"><Edit3 size={16} /></Button> <Button variant="danger" className="p-2" onClick={() => confirmDeleteClient(client)} title="Excluir"><Trash2 size={16} /></Button> </div> </li>))} </ul>)} </div>);};

// --- Componente ReportsPage ---
const ReportsPage = ({ userId, clients, onClientChange, selectedClientId, selectedClientName, setCurrentPage }) => {
    const [reportYear, setReportYear] = useState(new Date().getFullYear());
    const [reportData, setReportData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!userId || !selectedClientId || !reportYear) {
            setReportData(null);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            
            const assumptionsDocPath = `artifacts/${appId}/users/${userId}/clients/${selectedClientId}/assumptions/current`;
            const assumptionSnap = await getDoc(doc(db, assumptionsDocPath));
            const assumptions = assumptionSnap.exists() ? assumptionSnap.data() : initialAssumptions;

            const dresCollectionPath = `artifacts/${appId}/users/${userId}/dres`;
            const q = query(collection(db, dresCollectionPath), 
                            where("clientId", "==", selectedClientId), 
                            where("year", "==", reportYear));
            const querySnapshot = await getDocs(q);

            const monthlyResults = [];
            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                monthlyResults.push({
                    month: data.month,
                    ...calculateDreResults(data.inputs, assumptions)
                });
            });

            // Process data for annual reports
            const annualData = {
                kpis: { faturamentoTotal: 0, despesasTotais: 0, lucroLiquido: 0, margemMedia: 0 },
                monthlyPerformance: [],
                costStructure: [],
                channelAnalysis: { ifood: { sales: 0, margin: 0 }, site: { sales: 0, margin: 0 }, salao: { sales: 0, margin: 0 } }
            };

            const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            const allMonths = Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0'));
            
            let totalProfitMargin = 0;
            let monthsWithRevenue = 0;

            allMonths.forEach(month => {
                const monthData = monthlyResults.find(m => m.month === month);
                const faturamento = monthData?.faturamentoTotal || 0;
                const lucro = monthData?.resultadoLiquidoValor || 0;
                const despesas = (monthData?.totalCV || 0) + (monthData?.totalCustosFixosMensais || 0);

                annualData.monthlyPerformance.push({ name: monthNames[parseInt(month,10)-1], Faturamento: faturamento, Lucro: lucro, Despesas: despesas });
                
                const marketingCost = (monthData?.txV4Company || 0) + (monthData?.trafegoPagoDisplay || 0);
                const fixedCostWithoutMarketing = (monthData?.totalCustosFixosMensais || 0) - marketingCost - (monthData?.totalInvestimentos || 0);
                
                annualData.costStructure.push({ name: monthNames[parseInt(month,10)-1], 'Custos Variáveis': monthData?.totalCV || 0, 'Custos Fixos': fixedCostWithoutMarketing, 'Marketing & Capex': marketingCost + (monthData?.totalInvestimentos || 0) });
                
                if(faturamento > 0) {
                    annualData.kpis.faturamentoTotal += faturamento;
                    annualData.kpis.despesasTotais += despesas;
                    annualData.kpis.lucroLiquido += lucro;
                    totalProfitMargin += monthData.resultadoLiquidoPerc;
                    monthsWithRevenue++;
                }

                annualData.channelAnalysis.ifood.sales += monthData?.faturamentoIfood || 0;
                annualData.channelAnalysis.site.sales += monthData?.faturamentoSite || 0;
                annualData.channelAnalysis.salao.sales += monthData?.faturamentoSalao || 0;
                // Assuming margin contribution per channel can be derived
                annualData.channelAnalysis.ifood.margin += (monthData?.faturamentoIfood || 0) - ((monthData?.faturamentoIfood || 0) / (faturamento || 1) * (monthData?.totalCV || 0));
                annualData.channelAnalysis.site.margin += (monthData?.faturamentoSite || 0) - ((monthData?.faturamentoSite || 0) / (faturamento || 1) * (monthData?.totalCV || 0));
                annualData.channelAnalysis.salao.margin += (monthData?.faturamentoSalao || 0) - ((monthData?.faturamentoSalao || 0) / (faturamento || 1) * (monthData?.totalCV || 0));
            });

            annualData.kpis.margemMedia = monthsWithRevenue > 0 ? totalProfitMargin / monthsWithRevenue : 0;

            setReportData(annualData);
            setIsLoading(false);
        };

        fetchData();
    }, [userId, selectedClientId, reportYear]);

    if (!userId) return <p className="text-center mt-10">Login necessário.</p>;

    return (
        <div className="space-y-6">
            <div className="p-4 bg-white rounded-lg shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="clientSelect-reports" className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                        <select id="clientSelect-reports" value={selectedClientId} onChange={onClientChange} className="block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-v4-red focus:border-v4-red sm:text-sm">
                            <option value="">-- Selecione um Cliente --</option>
                            {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="yearSelect-reports" className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
                        <select id="yearSelect-reports" value={reportYear} onChange={(e) => setReportYear(parseInt(e.target.value, 10))} className="block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-v4-red focus:border-v4-red sm:text-sm">
                            {Array.from({length: 10}, (_, i) => new Date().getFullYear() - i).map(year => <option key={year} value={year}>{year}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {!selectedClientId ? (
                <NoClientSelected onNavigate={() => setCurrentPage('clients')} pageTitle="os Relatórios"/>
            ) : isLoading ? (
                <p className="text-center text-gray-600 mt-10 text-lg">Gerando relatórios...</p>
            ) : !reportData || reportData.kpis.faturamentoTotal === 0 ? (
                <div className="text-center text-gray-500 mt-10 p-6 bg-white rounded-lg shadow max-w-lg mx-auto">
                    <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-xl font-semibold text-gray-700">Sem Dados para o Período</p>
                    <p className="mt-2">Não foram encontrados dados de DRE para {selectedClientName} no ano de {reportYear}.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* KPIs Anuais */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                        <DashboardCard title="Faturamento Bruto Anual" value={reportData.kpis.faturamentoTotal} icon={<DollarSign size={24} />} />
                        <DashboardCard title="Despesas Totais Anual" value={reportData.kpis.despesasTotais} icon={<TrendingUp size={24} />} />
                        <DashboardCard title="Lucro Líquido Anual" value={reportData.kpis.lucroLiquido} icon={<Target size={24} />} />
                        <DashboardCard title="Margem de Lucro Média" value={reportData.kpis.margemMedia} icon={<Percent size={24} />} isPercentage={true} isCurrency={false} />
                    </div>

                    {/* Gráfico de Performance Anual */}
                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Desempenho Anual</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={reportData.monthlyPerformance}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={{fontSize: 12}} />
                                <YAxis tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`} tick={{fontSize: 12}} />
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Legend />
                                <Line type="monotone" dataKey="Faturamento" stroke={V4_RED} strokeWidth={2} />
                                <Line type="monotone" dataKey="Despesas" stroke="#718096" strokeWidth={2} />
                                <Line type="monotone" dataKey="Lucro" stroke="#48BB78" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    
                    {/* Gráfico de Estrutura de Custos */}
                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                         <h3 className="text-lg font-semibold text-gray-800 mb-4">Estrutura de Custos Mensal</h3>
                         <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={reportData.costStructure} stackOffset="sign">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={{fontSize: 12}} />
                                <YAxis tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`} tick={{fontSize: 12}} />
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Legend />
                                <Bar dataKey="Custos Variáveis" fill={CHART_COLORS[2]} stackId="a" />
                                <Bar dataKey="Custos Fixos" fill={CHART_COLORS[3]} stackId="a" />
                                <Bar dataKey="Marketing & Capex" fill={CHART_COLORS[4]} stackId="a" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                     {/* Tabela de Análise de Canal */}
                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Análise de Rentabilidade por Canal (Anual)</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Canal</th>
                                        <th scope="col" className="px-6 py-3">Vendas Totais</th>
                                        <th scope="col" className="px-6 py-3">Margem de Contribuição</th>
                                        <th scope="col" className="px-6 py-3">% do Total de Vendas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(reportData.channelAnalysis).map(([key, value]) => (
                                        <tr key={key} className="bg-white border-b">
                                            <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap capitalize">{key}</th>
                                            <td className="px-6 py-4">{formatCurrency(value.sales)}</td>
                                            <td className="px-6 py-4">{formatCurrency(value.margin)}</td>
                                            <td className="px-6 py-4">{reportData.kpis.faturamentoTotal > 0 ? ((value.sales / reportData.kpis.faturamentoTotal) * 100).toFixed(2) : 0}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Componente AnalysisPage ---
const AnalysisPage = ({ userId, clients, onClientChange, selectedClientId, selectedClientName, setCurrentPage, dreInputs: baseDreInputs, assumptions: baseAssumptions }) => {
    
    const initialSimulationParams = {
        pedidosPerc: 0,
        ticketMedioPerc: 0,
        trafegoPagoAbs: 0,
        custosVariaveisPerc: 0,
        custosFixosPerc: 0,
    };
    
    const [simulationParams, setSimulationParams] = useState(initialSimulationParams);

    const handleSliderChange = (param) => (e) => {
        setSimulationParams(prev => ({ ...prev, [param]: parseFloat(e.target.value) }));
    };

    const originalResults = useMemo(() => {
        return calculateDreResults(baseDreInputs, baseAssumptions);
    }, [baseDreInputs, baseAssumptions]);
    
    const simulatedResults = useMemo(() => {
        let simulatedInputs = JSON.parse(JSON.stringify(baseDreInputs));
        let simulatedAssumptions = JSON.parse(JSON.stringify(baseAssumptions));
        
        // Simular aumento de pedidos
        ['ifood', 'site', 'salao'].forEach(ch => {
            const originalPedidos = parseToNumber(simulatedInputs[`${ch}Pedidos`]);
            const newPedidos = originalPedidos * (1 + simulationParams.pedidosPerc / 100);
            simulatedInputs[`${ch}Pedidos`] = newPedidos;
        });
        
        // Simular aumento de Ticket Médio
        ['ifood', 'site', 'salao'].forEach(ch => {
            const originalTicket = parseToNumber(simulatedInputs[`${ch}TicketMedio`]);
            const newTicket = originalTicket * (1 + simulationParams.ticketMedioPerc / 100);
            simulatedInputs[`${ch}TicketMedio`] = newTicket;
             const pedidos = parseToNumber(simulatedInputs[`${ch}Pedidos`]);
             if(pedidos > 0 && newTicket > 0){
                 simulatedInputs[`${ch}ValorVendas`] = pedidos * newTicket;
             }
        });
        
        // Simular aumento absoluto do tráfego pago
        simulatedInputs.trafegoPago = parseToNumber(simulatedInputs.trafegoPago) + simulationParams.trafegoPagoAbs;
        
        // Simular redução/aumento de custos fixos
         const cfKeys = ['aluguel', 'condominio', 'iptu', 'agua', 'luz', 'telefoneInternet', 'softwareGestao', 'contabilidade', 'proLabore', 'salarios', 'encargos', 'beneficios', 'outrosCustosFixos'];
        cfKeys.forEach(key => {
            simulatedInputs[key] = parseToNumber(simulatedInputs[key]) * (1 + simulationParams.custosFixosPerc / 100);
        });

        // Simular redução/aumento de custos variáveis
        const cvKeys = ['fretePorVenda', 'impostoPorVenda', 'materiaPrimaPorVenda', 'gatewayPorVenda', 'outrosCustosVariaveisPorVenda'];
        cvKeys.forEach(key => {
            simulatedAssumptions[key] = parseToNumber(simulatedAssumptions[key]) * (1 + simulationParams.custosVariaveisPerc / 100);
        });

        return calculateDreResults(simulatedInputs, simulatedAssumptions);
        
    }, [simulationParams, baseDreInputs, baseAssumptions]);
    
    const impact = {
        faturamento: simulatedResults.faturamentoTotal - originalResults.faturamentoTotal,
        lucro: simulatedResults.resultadoLiquidoValor - originalResults.resultadoLiquidoValor,
        faturamentoPerc: originalResults.faturamentoTotal > 0 ? ((simulatedResults.faturamentoTotal - originalResults.faturamentoTotal) / originalResults.faturamentoTotal) * 100 : (simulatedResults.faturamentoTotal > 0 ? Infinity : 0),
        lucroPerc: Math.abs(originalResults.resultadoLiquidoValor) > 0.001 ? ((simulatedResults.resultadoLiquidoValor - originalResults.resultadoLiquidoValor) / Math.abs(originalResults.resultadoLiquidoValor)) * 100 : (simulatedResults.resultadoLiquidoValor > 0 ? Infinity : 0)
    };
    
    const comparisonData = [
        { name: 'Receita Bruta', Atual: originalResults.faturamentoTotal, Simulado: simulatedResults.faturamentoTotal },
        { name: 'Lucro Líquido', Atual: originalResults.resultadoLiquidoValor, Simulado: simulatedResults.resultadoLiquidoValor }
    ];
    
     const breakevenData = [
        { name: 'Ponto de Equilíbrio', Atual: originalResults.pontoEquilibrioValor, Simulado: simulatedResults.pontoEquilibrioValor, "Faturamento Simulado": simulatedResults.faturamentoTotal },
    ];

    if (!userId) return <p className="text-center mt-10">Login necessário.</p>;
    
     if (!selectedClientId) {
        return (
             <div className="max-w-3xl mx-auto">
                <div className="p-4 bg-white rounded-lg shadow-md mb-6">
                    <label htmlFor="clientSelect-analysis" className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                    <select id="clientSelect-analysis" value={selectedClientId} onChange={onClientChange} className="block w-full p-2 border-gray-300 rounded-md shadow-sm">
                        <option value="">-- Selecione um Cliente --</option>
                        {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                    </select>
                </div>
                <NoClientSelected onNavigate={() => setCurrentPage('clients')} pageTitle="a Análise de Cenários"/>
            </div>
        )
    }
    
    const SimulationSlider = ({ label, value, onChange, min, max, step, unit = '', info }) => (
        <div className="mb-4">
            <label className="flex items-center text-sm font-medium text-gray-700">
                {label}
                {info && 
                  <span title={info} className="ml-2 text-gray-400 cursor-help">
                    <HelpCircle size={14} />
                  </span>
                }
            </label>
            <div className="flex items-center space-x-4">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={onChange}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer custom-slider"
                />
                <span className="font-semibold text-sm text-gray-800 w-24 text-right">{unit === 'R$' ? `${unit} ${value}` : `${value.toLocaleString('pt-BR')}${unit}`}</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
             <div className="p-4 bg-white rounded-lg shadow-md">
                <p className="text-gray-600">Usando como base os dados de <span className="font-bold text-gray-800">{selectedClientName}</span> para o período selecionado no Dashboard.</p>
                <p className="text-xs text-gray-500">Para simular com base em outro mês, por favor, altere o período na página do Dashboard ou Entrada DRE.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Painel de Controles */}
                <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
                    <h3 className="text-lg font-semibold text-gray-800">Parâmetros da Simulação</h3>
                    <SimulationSlider label="Aumento de Pedidos" value={simulationParams.pedidosPerc} onChange={handleSliderChange('pedidosPerc')} min={0} max={100} step={5} unit="%" info="Simula o impacto de um aumento percentual no número de pedidos em todos os canais."/>
                    <SimulationSlider label="Aumento de Ticket Médio" value={simulationParams.ticketMedioPerc} onChange={handleSliderChange('ticketMedioPerc')} min={0} max={100} step={5} unit="%" info="Simula o impacto de um aumento percentual no valor do ticket médio."/>
                    <SimulationSlider label="Aumento Invest. Ads (Absoluto)" value={simulationParams.trafegoPagoAbs} onChange={handleSliderChange('trafegoPagoAbs')} min={0} max={5000} step={100} unit=" R$" info="Simula o impacto de um aumento absoluto (em R$) no investimento em tráfego pago."/>
                    <SimulationSlider label="Variação de Custos Variáveis" value={simulationParams.custosVariaveisPerc} onChange={handleSliderChange('custosVariaveisPerc')} min={-50} max={50} step={5} unit="%" info="Simula o impacto de uma variação percentual nos custos variáveis por venda."/>
                    <SimulationSlider label="Variação de Custos Fixos" value={simulationParams.custosFixosPerc} onChange={handleSliderChange('custosFixosPerc')} min={-50} max={50} step={5} unit="%" info="Simula o impacto de uma variação percentual nos custos fixos mensais (excluindo taxa V4 e Ads)."/>
                </div>

                {/* Painel de Resultados */}
                <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800">Resultados da Simulação</h3>
                     <div>
                        <h4 className="text-md font-medium text-gray-600 mb-2">Análise de Impacto</h4>
                        <div className="p-3 bg-red-50 rounded-md">
                           <div className="flex justify-between items-center text-sm">
                               <span>Impacto na Receita</span>
                               <span className={`font-semibold ${impact.faturamento >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                   {formatCurrency(impact.faturamento)} ({isFinite(impact.faturamentoPerc) ? impact.faturamentoPerc.toFixed(2) : 'N/A'}%)
                               </span>
                           </div>
                           <div className="flex justify-between items-center text-sm mt-1">
                               <span>Impacto no Lucro</span>
                               <span className={`font-semibold ${impact.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                   {formatCurrency(impact.lucro)} ({isFinite(impact.lucroPerc) ? impact.lucroPerc.toFixed(2) : 'N/A'}%)
                               </span>
                           </div>
                        </div>
                    </div>

                    {/* Gráfico de Comparação */}
                    <div className="pt-4">
                         <h4 className="text-md font-medium text-gray-600 mb-2">Comparativo de Resultados</h4>
                        <ResponsiveContainer width="100%" height={150}>
                            <BarChart data={comparisonData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                               <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                               <XAxis type="number" hide/>
                               <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 12}}/>
                               <Tooltip formatter={(value) => formatCurrency(value)}/>
                               <Bar dataKey="Atual" fill="#A0AEC0" name="Resultado Atual"/>
                               <Bar dataKey="Simulado" fill={V4_RED} name="Resultado Simulado"/>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                </div>
                 {/* Gráfico de Ponto de Equilíbrio */}
                 <div className="bg-white p-6 rounded-lg shadow-md xl:col-span-2">
                     <h3 className="text-lg font-semibold text-gray-800 mb-4">Análise de Ponto de Equilíbrio</h3>
                     <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={breakevenData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                           <CartesianGrid strokeDasharray="3 3" />
                           <XAxis dataKey="name" hide/>
                           <YAxis tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`} />
                           <Tooltip formatter={(value) => formatCurrency(value)}/>
                           <Legend />
                           <Bar dataKey="Atual" name="P.E. Atual" fill="#A0AEC0" barSize={50}/>
                           <Bar dataKey="Simulado" name="P.E. Simulado" fill={CHART_COLORS[4]} barSize={50}/>
                           <Bar dataKey="Faturamento Simulado" name="Faturamento Simulado" fill={V4_RED} barSize={50}/>
                        </BarChart>
                     </ResponsiveContainer>
                 </div>
            </div>
        </div>
    );
};


// --- Componente App principal ---
const App = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [userId, setUserId] = useState(null); const [authReady, setAuthReady] = useState(false);
  const [clients, setClients] = useState([]); const [selectedClientId, setSelectedClientId] = useState(''); const [selectedClientName, setSelectedClientName] = useState('');
  const [assumptions, setAssumptions] = useState(initialAssumptions);
  const [assumptionsLoading, setAssumptionsLoading] = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', content: null });
  const [isExporting, setIsExporting] = useState(false);

  const openModal = (title, content, hasCloseButton = true) => setModalConfig({ isOpen: true, title, content, hasCloseButton });
  const closeModal = () => setModalConfig({ isOpen: false, title: '', content: null, hasCloseButton: true });

  const currentYear = new Date().getFullYear(); const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const [selectedYear, setSelectedYear] = useState(currentYear); const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [dreInputs, setDreInputs] = useState(initialDreInputs);
  const [dreLoading, setDreLoading] = useState(false); const [dreError, setDreError] = useState(''); const [isSaving, setIsSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [monthlyData, setMonthlyData] = useState([]);
  const [monthlyDataLoading, setMonthlyDataLoading] = useState(false);

  // Carregar bibliotecas de exportação
  useEffect(() => {
    const loadScript = (src, id) => {
        if (document.getElementById(id)) return;
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.async = true;
        document.head.appendChild(script);
    };
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf-script');
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas-script');
  }, []);

  useEffect(() => {
    if (!isExporting) return;

    const performExport = async () => {
        const exportArea = document.getElementById('pdf-export-area');
        if (!exportArea) {
            openModal("Erro", "Não foi possível encontrar o conteúdo para exportar.");
            setIsExporting(false);
            closeModal();
            return;
        }

        try {
            const canvas = await window.html2canvas(exportArea, {
                scale: 2, 
                useCORS: true,
                logging: true,
                backgroundColor: '#f9fafb',
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.9);
            const { jsPDF } = window.jspdf;
            
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const imgHeight = canvasHeight * pdfWidth / canvasWidth;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position -= pageHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            const pageTitle = currentPage === 'dashboard' ? 'Dashboard' : 'Entrada_DRE';
            const clientName = selectedClientName.replace(/\s/g, '_') || "Cliente";
            const fileName = `${pageTitle}_${clientName}_${selectedMonth}_${selectedYear}.pdf`;
            
            pdf.save(fileName);

        } catch (err) {
            console.error("Error exporting PDF:", err);
            openModal("Erro", "Ocorreu um erro ao gerar o PDF. Verifique o console para mais detalhes.");
        } finally {
            setIsExporting(false);
            closeModal();
        }
    };

    // Usar requestAnimationFrame para garantir que a renderização do estado 'isExporting' esteja completa
    requestAnimationFrame(() => {
        requestAnimationFrame(performExport);
    });

  }, [isExporting, currentPage, selectedClientName, selectedMonth, selectedYear]);

  const handleExportClick = () => {
      if (!window.jspdf || !window.html2canvas) {
          openModal("Erro", "Bibliotecas de exportação ainda estão carregando. Tente novamente em alguns segundos.");
          return;
      }
      openModal("Exportando...", <div className="flex items-center justify-center p-4"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div><p className="ml-3">Preparando documento...</p></div>, false);
      setIsExporting(true);
  };

  useEffect(() => { const performSignIn = async () => { try { await setPersistence(auth, browserLocalPersistence); if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken); else await signInAnonymously(auth); } catch (error) { console.error("Auth Error:", error); }}; performSignIn(); const unsub = onAuthStateChanged(auth, (user) => { setUserId(user ? user.uid : null); setAuthReady(true); }); return () => unsub(); }, []);
  useEffect(() => { if (!userId) { setClients([]); setSelectedClientId(''); setSelectedClientName(''); return; } const q = query(collection(db, `artifacts/${appId}/users/${userId}/clients`), orderBy("name")); const unsub = onSnapshot(q, (snap) => { const cData = snap.docs.map(d => ({ id: d.id, name: d.data().name })); setClients(cData); if (selectedClientId) { const curSel = cData.find(c => c.id === selectedClientId); if (curSel) setSelectedClientName(curSel.name); else { setSelectedClientId(''); setSelectedClientName(''); } } }, (err) => console.error("Erro clientes:", err)); return () => unsub(); }, [userId, selectedClientId]);

  // Fetch monthly data for charts
  useEffect(() => {
    if (!userId || !selectedClientId || !selectedYear) {
      setMonthlyData([]);
      return;
    }
    
    let clientAssumptions = initialAssumptions;
    const assumptionDocPath = `artifacts/${appId}/users/${userId}/clients/${selectedClientId}/assumptions/current`;
    const assumptionPromise = getDoc(doc(db, assumptionDocPath)).then(docSnap => {
        if(docSnap.exists()){
            clientAssumptions = {...initialAssumptions, ...docSnap.data()};
        }
    });

    setMonthlyDataLoading(true);
    const dresCollectionPath = `artifacts/${appId}/users/${userId}/dres`;
    const q = query(collection(db, dresCollectionPath), 
                    where("clientId", "==", selectedClientId), 
                    where("year", "==", selectedYear));

    const unsub = onSnapshot(q, async (querySnapshot) => {
        await assumptionPromise; // Garante que as premissas foram carregadas
        const allMonthsData = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const results = calculateDreResults(data.inputs, clientAssumptions);
            
            if (results.faturamentoTotal > 0) {
              allMonthsData.push({
                  month: data.month,
                  faturamento: results.faturamentoTotal,
                  lucroLiquido: results.resultadoLiquidoValor
              });
            }
        });
        setMonthlyData(allMonthsData.sort((a,b) => a.month.localeCompare(b.month)));
        setMonthlyDataLoading(false);
    }, (error) => {
        console.error("Error fetching monthly DRE data: ", error);
        setMonthlyDataLoading(false);
    });

    return () => unsub();
  }, [userId, selectedClientId, selectedYear]);


  const assumptionDocPath = useMemo(() => { if (!userId || !selectedClientId) return null; return `artifacts/${appId}/users/${userId}/clients/${selectedClientId}/assumptions/current`; }, [userId, selectedClientId]);
  useEffect(() => { if (!assumptionDocPath) { setAssumptions(initialAssumptions); return; } setAssumptionsLoading(true); const unsub = onSnapshot(doc(db, assumptionDocPath), (docSnap) => { if (docSnap.exists()) setAssumptions({ ...initialAssumptions, ...docSnap.data() }); else setAssumptions(initialAssumptions); setAssumptionsLoading(false); }, (err) => { console.error("Erro premissas cliente:", err); setAssumptionsLoading(false);}); return () => unsub(); }, [assumptionDocPath]);
  const handleClientSelection = (clientId, targetPage = 'dashboard') => { setSelectedClientId(clientId); const cli = clients.find(c => c.id === clientId); if (cli) setSelectedClientName(cli.name); setCurrentPage(targetPage); setSidebarOpen(false); };
  const handleClientChangeOnPage = (e) => { const newClientId = e.target.value; setSelectedClientId(newClientId); const cli = clients.find(c => c.id === newClientId); if (cli) setSelectedClientName(cli.name);};

  const dreDocId = useMemo(() => { if (!selectedClientId || !selectedYear || !selectedMonth) return null; return `${selectedClientId}_${selectedYear}_${selectedMonth}`; }, [selectedClientId, selectedYear, selectedMonth]);
  
  const debouncedSaveDre = useMemo(() => debounce(async (inputsToSave) => {
        if (!userId || !dreDocId || dreLoading || assumptionsLoading) return;
        const allDef = Object.values(inputsToSave).every(v => v === '' || v === 0 || v === '0' || isNaN(parseToNumber(v)));
        const dRef = doc(db, `artifacts/${appId}/users/${userId}/dres/${dreDocId}`);
        const dSnap = await getDoc(dRef);
        if (allDef && !dSnap.exists()) { console.log("Novo DRE vazio, não salvando."); return; }
        setIsSaving(true); setDreError('');
        try {
            await setDoc(dRef, { clientId: selectedClientId, year: selectedYear, month: selectedMonth, inputs: inputsToSave, updatedAt: serverTimestamp(), createdAt: dSnap.exists() ? dSnap.data().createdAt || serverTimestamp() : serverTimestamp() }, { merge: true });
            console.log("DRE salvo:", dreDocId);
        } catch (err) { console.error("Erro salvar DRE:", err); setDreError("Falha ao salvar o DRE."); } finally { setIsSaving(false); }
    }, 1500),
    [userId, dreDocId, selectedClientId, selectedYear, selectedMonth, dreLoading, assumptionsLoading]
  );
  
  useEffect(() => { return () => { debouncedSaveDre.cancel(); } }, [debouncedSaveDre]);

  useEffect(() => { if (!userId || !dreDocId) { setDreInputs(initialDreInputs); setDreLoading(false); return; } setDreLoading(true); setDreError(''); const path = `artifacts/${appId}/users/${userId}/dres/${dreDocId}`; const unsub = onSnapshot(doc(db, path), (snap) => { if (snap.exists()) setDreInputs({ ...initialDreInputs, ...snap.data().inputs }); else setDreInputs(initialDreInputs); setDreLoading(false); }, (err) => { console.error("Erro DRE:", err); setDreError("Falha DRE."); setDreLoading(false); }); return () => unsub(); }, [userId, dreDocId]);
  
  const handleDreInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setDreInputs(prevInputs => {
      let updatedInputs = { ...prevInputs, [name]: value };
      const channelPrefix = name.match(/^(ifood|site|salao)/)?.[0];
      if (channelPrefix) {
        const pedidosKey = `${channelPrefix}Pedidos`; const ticketKey = `${channelPrefix}TicketMedio`; const valorKey = `${channelPrefix}ValorVendas`;
        let pedidosNum = parseToNumber(updatedInputs[pedidosKey]); let ticketNum = parseToNumber(updatedInputs[ticketKey]); let valorNum = parseToNumber(updatedInputs[valorKey]);
        const sourceField = name;
        if (sourceField === pedidosKey || sourceField === ticketKey) { if (!isNaN(pedidosNum) && !isNaN(ticketNum)) { valorNum = pedidosNum * ticketNum; updatedInputs[valorKey] = isNaN(valorNum) ? '' : valorNum.toFixed(2); } } else if (sourceField === valorKey) { if (!isNaN(valorNum) && !isNaN(pedidosNum) && pedidosNum > 0) { ticketNum = valorNum / pedidosNum; updatedInputs[ticketKey] = isNaN(ticketNum) ? '' : ticketNum.toFixed(2); } else if (!isNaN(valorNum) && !isNaN(ticketNum) && ticketNum > 0) { pedidosNum = valorNum / ticketNum; updatedInputs[pedidosKey] = isNaN(pedidosNum) ? '' : Math.round(pedidosNum).toString(); } }
      }
      debouncedSaveDre(updatedInputs);
      return updatedInputs;
    });
  }, [debouncedSaveDre]);

  const navigationItems = [ { id: 'dashboard', label: 'Dashboard', icon: <BarChart2 size={20}/> }, { id: 'assumptions', label: 'Premissas', icon: <Archive size={20}/> }, { id: 'dre', label: 'Entrada DRE', icon: <FileText size={20}/> }, { id: 'clients', label: 'Clientes', icon: <Building size={20}/> }, { id: 'reports', label: 'Relatórios', icon: <FilePieChart size={20}/> }, { id: 'analysis', label: 'Análise', icon: <BarChartHorizontal size={20}/> }, ];
  const bottomNavigationItems = [ { id: 'help', label: 'Ajuda', icon: <HelpCircle size={20}/> }, { id: 'settings', label: 'Configurações', icon: <Settings size={20}/> }, ];

  const renderPageContent = () => {
    if (!authReady) return <div className="flex justify-center items-center h-screen"><p className="text-lg">Autenticando...</p></div>;
    if (!userId) return <div className="flex justify-center items-center h-screen"><LogIn className="mr-2 text-lg"/><span>Aguarde o login...</span></div>;

    const commonDrePageSetup = (viewMode) => (
      <>
        <div className="mb-6 p-4 bg-white rounded-lg shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor={`clientSelect-${viewMode}`} className="block text-sm font-medium text-gray-700 mb-1">Cliente Ativo</label>
              <select id={`clientSelect-${viewMode}`} value={selectedClientId} onChange={handleClientChangeOnPage} className="block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-v4-red focus:border-v4-red sm:text-sm" disabled={clients.length === 0}>
                <option value="">{clients.length === 0 ? "Nenhum cliente" : "-- Selecione um Cliente --"}</option>
                {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`yearSelect-${viewMode}`} className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
              <input type="number" id={`yearSelect-${viewMode}`} value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-v4-red focus:border-v4-red sm:text-sm" placeholder="AAAA" min="2000" max="2100"/>
            </div>
            <div>
              <label htmlFor={`monthSelect-${viewMode}`} className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
              <select id={`monthSelect-${viewMode}`} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-v4-red focus:border-v4-red sm:text-sm">{Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(month => <option key={month} value={month}>{month}</option>)}</select>
            </div>
          </div>
          {dreError && <p className="text-red-500 mt-2 text-sm">{dreError}</p>}
          {isSaving && <p className="text-blue-500 mt-2 text-sm animate-pulse">Salvando DRE...</p>}
        </div>
        { selectedClientId ? 
            ((dreLoading || assumptionsLoading || monthlyDataLoading) ? 
              <p className="text-center text-gray-600 mt-10 text-lg">Carregando dados...</p> : 
              <DreCalculator dreInputs={dreInputs} assumptions={assumptions} onDreInputChange={handleDreInputChange} disabled={!selectedClientId || dreLoading || assumptionsLoading} viewMode={viewMode} monthlyData={monthlyData} isExporting={isExporting} />
            ) : (
              <NoClientSelected onNavigate={() => setCurrentPage('clients')} />
            )
        }
      </>
    );

    switch (currentPage) {
      case 'dashboard': return commonDrePageSetup('dashboardOnly');
      case 'dre': return commonDrePageSetup('full');
      case 'assumptions': return <AssumptionsPage userId={userId} selectedClientId={selectedClientId} selectedClientName={selectedClientName} clients={clients} onClientChange={handleClientChangeOnPage} openModal={openModal} setCurrentPage={setCurrentPage} />;
      case 'clients': return <ClientsPage userId={userId} onClientSelect={handleClientSelection} openModal={openModal} closeModal={closeModal} />;
      case 'reports': return <ReportsPage userId={userId} clients={clients} onClientChange={handleClientChangeOnPage} selectedClientId={selectedClientId} selectedClientName={selectedClientName} setCurrentPage={setCurrentPage} />;
      case 'analysis': return <AnalysisPage userId={userId} clients={clients} onClientChange={handleClientChangeOnPage} selectedClientId={selectedClientId} selectedClientName={selectedClientName} setCurrentPage={setCurrentPage} dreInputs={dreInputs} assumptions={assumptions} />;
      case 'help': return <PlaceholderPage title="Ajuda" icon={<HelpCircle/>}/>;
      case 'settings': return <PlaceholderPage title="Configurações" icon={<Settings/>}/>;
      default: return <PlaceholderPage title="Página não encontrada" icon={<XCircle/>}/>;
    }
  };
  return ( 
  <div className="flex h-screen bg-gray-100 font-sans"> 
    <style>{`
      .custom-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        background: ${V4_RED};
        border-radius: 50%;
        cursor: pointer;
      }

      .custom-slider::-moz-range-thumb {
        width: 20px;
        height: 20px;
        background: ${V4_RED};
        border-radius: 50%;
        cursor: pointer;
      }
    `}</style>
    <Modal isOpen={modalConfig.isOpen} onClose={modalConfig.hasCloseButton ? closeModal : null} title={modalConfig.title}>
        {modalConfig.content}
    </Modal>
    {sidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" onClick={() => setSidebarOpen(false)}></div>}
    <aside className={`bg-white text-gray-700 w-64 space-y-6 py-7 px-2 absolute inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out z-30 shadow-lg md:shadow-none flex flex-col`}> 
      <div className="px-4 mb-2"> <a href="#" onClick={(e) => {e.preventDefault(); setCurrentPage('dashboard'); setSidebarOpen(false);}} className={`text-2xl font-extrabold text-v4-red`}>{V4_TEXT_LOGO}</a> <p className="text-xs text-gray-500">Dashboard Financeiro</p> </div> 
      <nav className="flex-grow"> {navigationItems.map(item => ( <a key={item.id} href="#" onClick={(e) => {e.preventDefault(); setCurrentPage(item.id); setSidebarOpen(false);}} className={`flex items-center space-x-3 py-2.5 px-4 rounded-md text-sm hover:bg-red-50 hover:text-v4-red transition-colors ${currentPage === item.id ? `bg-v4-red text-white font-semibold shadow-md` : 'text-gray-600'}`}> {item.icon}<span>{item.label}</span> </a>))} </nav> 
      <div className="mt-auto"> {bottomNavigationItems.map(item => ( <a key={item.id} href="#" onClick={(e) => {e.preventDefault(); setCurrentPage(item.id); setSidebarOpen(false);}} className={`flex items-center space-x-3 py-2.5 px-4 rounded-md text-sm hover:bg-red-50 hover:text-v4-red transition-colors ${currentPage === item.id ? `bg-v4-red text-white font-semibold shadow-md` : 'text-gray-600'}`}> {item.icon}<span>{item.label}</span> </a> ))} {userId && <div className="text-xs text-gray-400 p-4 mt-2 border-t border-gray-200 break-all">ID: {userId}</div>} </div> 
    </aside> 
    <div className="flex-1 flex flex-col overflow-hidden"> 
      <header className="bg-white shadow-sm p-4"> 
        <div className="flex items-center justify-between"> 
          <div className="flex items-center"> 
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 focus:outline-none md:hidden mr-4"> <Menu size={24} /> </button> 
            <h2 className="text-lg sm:text-xl font-semibold text-gray-700 truncate"> {selectedClientId && (currentPage === 'dashboard' || currentPage === 'dre' || currentPage === 'assumptions' || currentPage === 'reports' || currentPage === 'analysis') ? `${selectedClientName || 'Cliente'}` : navigationItems.find(nav => nav.id === currentPage)?.label || "Dashboard"} </h2> 
            {(currentPage === 'dashboard' || currentPage === 'dre' || currentPage === 'assumptions' || currentPage === 'reports' || currentPage === 'analysis') && selectedClientId && <Edit3 size={18} className="ml-2 text-gray-400 hover:text-v4-red cursor-pointer flex-shrink-0" title="Mudar Cliente" onClick={() => setCurrentPage('clients')}/> } 
          </div> 
          <div className="flex items-center space-x-2 sm:space-x-3"> 
            <Button variant="secondary" className="text-sm py-1.5 px-2 sm:px-3" id="headerSaveButton" onClick={() => { if (currentPage === 'assumptions' && selectedClientId) { const saveAssumptionsBtn = document.getElementById('saveAssumptionsButton'); if (saveAssumptionsBtn) saveAssumptionsBtn.click(); else openModal("Erro", "Não foi possível encontrar a função para salvar."); } else if (selectedClientId && dreDocId && (currentPage === 'dre' || currentPage === 'dashboard')) { debouncedSaveDre.flush(); openModal("Sucesso", "O DRE foi salvo manualmente!"); } else { openModal("Atenção", "Selecione um cliente e um período para poder salvar, ou navegue para a página de premissas de um cliente."); } }}> <Save size={16} className="mr-0 sm:mr-1.5"/> <span className="hidden sm:inline">Salvar</span> </Button> 
            {(currentPage === 'dashboard' || currentPage === 'dre') && (
                <Button variant="primary" className="text-sm py-1.5 px-2 sm:px-3" onClick={handleExportClick} disabled={!selectedClientId}>
                    <FileText size={16} className="mr-0 sm:mr-1.5"/>
                    <span className="hidden sm:inline">Exportar</span>
                </Button>
            )}
          </div> 
        </div> 
      </header> 
      <main id="main-content-area" className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
        <div id="pdf-export-area" className="p-4 sm:p-6">
          {renderPageContent()}
        </div>
      </main> 
    </div> 
  </div> );
};

export default App;
