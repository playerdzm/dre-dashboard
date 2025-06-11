import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart2, DollarSign, TrendingUp, Percent, Target, Briefcase, ShoppingCart, Users, CreditCard, FileText, Lightbulb, User, Building, CalendarDays, Save, PlusCircle, Trash2, LogIn, Edit3, XCircle, Menu, Settings, HelpCircle, FilePieChart, BarChartHorizontal, Archive } from 'lucide-react';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, Timestamp, orderBy, serverTimestamp, runTransaction, getDocs } from 'firebase/firestore';
import { setLogLevel } from 'firebase/app';

// Configuração do seu Firebase (substitua pelos valores do Console)
const firebaseConfig = {
  apiKey: "AIzaSyBu8bPCkcEH5VQBDFFQGnnJTxYu9Ol6F1E",
  authDomain: "dre-dashboard-667b0.firebaseapp.com",
  projectId: "dre-dashboard-667b0",
  storageBucket: "dre-dashboard-667b0.appspot.com",
  messagingSenderId: "27620391126",
  appId: "1:27620391126:web:27ea60d4e9464077517177"
};

// Identificador do app – pode usar qualquer string única para seu projeto
const appId = "1:27620391126:web:27ea60d4e9464077517177";

// Você não precisa de token customizado agora
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


// --- Helpers ---
function debounce(func, wait) {
    let timeout;
    let latestArgs;

    const debounced = (...args) => {
        latestArgs = args;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            if (latestArgs) {
                func(...latestArgs);
            }
        }, wait);
    };

    debounced.flush = () => {
        clearTimeout(timeout);
        if (latestArgs) {
            func(...latestArgs);
            latestArgs = null;
        }
    };
    
    debounced.cancel = () => {
        clearTimeout(timeout);
        latestArgs = null;
    }

    return debounced;
}

// --- Componentes UI reutilizáveis ---
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity duration-300" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-5 sm:p-6 max-w-lg w-full transform transition-all duration-300 scale-95" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400">
                        <XCircle size={24} />
                    </button>
                </div>
                <div>{children}</div>
            </div>
        </div>
    );
};

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

// --- Estruturas de Dados Iniciais ---
const initialDreInputs = {
  ifoodPedidos: '', ifoodTicketMedio: '', ifoodValorVendas: '',
  sitePedidos: '', siteTicketMedio: '', siteValorVendas: '',
  salaoPedidos: '', salaoTicketMedio: '', salaoValorVendas: '',
  trafegoPago: '',
  aluguel: '', condominio: '', iptu: '', agua: '', luz: '', telefoneInternet: '', softwareGestao: '', contabilidade: '', proLabore: '', salarios: '', encargos: '', beneficios: '',
  outrosCustosFixos: '',
  capex: '', taxaConversaoIfood: '', taxaConversaoSiteProprio: '',
};

const initialAssumptions = {
  fretePorVenda: '', impostoPorVenda: '', materiaPrimaPorVenda: '', gatewayPorVenda: '', outrosCustosVariaveisPorVenda: '',
  txV4Company: '',
};

const parseToNumber = (value) => {
  if (value === '' || value === null || value === undefined) return NaN;
  const parsed = parseFloat(String(value).replace(',', '.'));
  return parsed;
};

// --- Componente DreCalculator ---
const DreCalculator = ({ dreInputs, assumptions, onDreInputChange, disabled, viewMode = 'full' }) => {
  const [results, setResults] = useState({});
  const [activeSection, setActiveSection] = useState('faturamentoCanais');
  
  useEffect(() => {
    const parsedDreInputs = Object.keys(dreInputs).reduce((acc, key) => { acc[key] = parseToNumber(dreInputs[key]); return acc; }, {});
    const parsedAssumptions = Object.keys(assumptions).reduce((acc, key) => { acc[key] = parseToNumber(assumptions[key]); return acc; }, {});

    const {
      ifoodPedidos, ifoodTicketMedio, ifoodValorVendas,
      sitePedidos, siteTicketMedio, siteValorVendas,
      salaoPedidos, salaoTicketMedio, salaoValorVendas,
      trafegoPago, aluguel, condominio, iptu, agua, luz, telefoneInternet, softwareGestao, contabilidade, proLabore, salarios, encargos, beneficios, outrosCustosFixos, capex
    } = parsedDreInputs;
    const { fretePorVenda, impostoPorVenda, materiaPrimaPorVenda, gatewayPorVenda, outrosCustosVariaveisPorVenda, txV4Company } = parsedAssumptions;

    const currentFaturamentoIfood = !isNaN(ifoodValorVendas) ? ifoodValorVendas : 0;
    const currentFaturamentoSite = !isNaN(siteValorVendas) ? siteValorVendas : 0;
    const currentFaturamentoSalao = !isNaN(salaoValorVendas) ? salaoValorVendas : 0;
    const faturamentoTotal = currentFaturamentoIfood + currentFaturamentoSite + currentFaturamentoSalao;
    
    const totalPedidosValidos = (isNaN(ifoodPedidos) ? 0 : ifoodPedidos) + (isNaN(sitePedidos) ? 0 : sitePedidos) + (isNaN(salaoPedidos) ? 0 : salaoPedidos);

    const freteTotal = (isNaN(fretePorVenda) ? 0 : fretePorVenda) * totalPedidosValidos;
    const impostoTotal = (isNaN(impostoPorVenda) ? 0 : impostoPorVenda) * totalPedidosValidos;
    const materiaPrimaTotal = (isNaN(materiaPrimaPorVenda) ? 0 : materiaPrimaPorVenda) * totalPedidosValidos;
    const gatewayTotal = (isNaN(gatewayPorVenda) ? 0 : gatewayPorVenda) * totalPedidosValidos;
    const outrosCVTotal = (isNaN(outrosCustosVariaveisPorVenda) ? 0 : outrosCustosVariaveisPorVenda) * totalPedidosValidos;
    const totalCV = freteTotal + impostoTotal + materiaPrimaTotal + gatewayTotal + outrosCVTotal;
    
    const totalDeducoes = 0;
    const receitaLiquida = faturamentoTotal - totalDeducoes;

    const margemContribuicaoValor = receitaLiquida - totalCV;
    const margemContribuicaoPerc = faturamentoTotal !== 0 ? (margemContribuicaoValor / faturamentoTotal) * 100 : 0;

    const cfMensais = (isNaN(aluguel)?0:aluguel) + (isNaN(condominio)?0:condominio) + (isNaN(iptu)?0:iptu) + (isNaN(agua)?0:agua) + (isNaN(luz)?0:luz) + (isNaN(telefoneInternet)?0:telefoneInternet) + (isNaN(softwareGestao)?0:softwareGestao) + (isNaN(contabilidade)?0:contabilidade) + (isNaN(proLabore)?0:proLabore) + (isNaN(salarios)?0:salarios) + (isNaN(encargos)?0:encargos) + (isNaN(beneficios)?0:beneficios) + (isNaN(outrosCustosFixos)?0:outrosCustosFixos);
    const totalCustosFixosMensais = cfMensais + (isNaN(txV4Company)?0:txV4Company) + (isNaN(trafegoPago)?0:trafegoPago);

    const resultadoOperacionalValor = margemContribuicaoValor - totalCustosFixosMensais;
    const resultadoOperacionalPerc = faturamentoTotal !== 0 ? (resultadoOperacionalValor / faturamentoTotal) * 100 : 0;
    
    const totalInvestimentos = isNaN(capex) ? 0 : capex;
    const resultadoLiquidoValor = resultadoOperacionalValor - totalInvestimentos;
    const resultadoLiquidoPerc = faturamentoTotal !== 0 ? (resultadoLiquidoValor / faturamentoTotal) * 100 : 0;

    const pontoEquilibrioValor = margemContribuicaoPerc !== 0 ? totalCustosFixosMensais / (margemContribuicaoPerc / 100) : 0;
    const ticketMedioTotalCalculado = totalPedidosValidos > 0 ? faturamentoTotal / totalPedidosValidos : 0;
    const pontoEquilibrioPedidos = ticketMedioTotalCalculado > 0 ? pontoEquilibrioValor / ticketMedioTotalCalculado : 0;
    
    const denominadorCac = (isNaN(ifoodPedidos) ? 0 : ifoodPedidos) + (isNaN(sitePedidos) ? 0 : sitePedidos);
    const cac = denominadorCac > 0 && !isNaN(trafegoPago) && trafegoPago > 0 ? trafegoPago / denominadorCac : 0;
    
    const custoTotalMarketing = (isNaN(txV4Company)?0:txV4Company) + (isNaN(trafegoPago)?0:trafegoPago);
    const roiMarketing = custoTotalMarketing !== 0 ? ((margemContribuicaoValor - custoTotalMarketing) / custoTotalMarketing) * 100 : 0;
    
    const faturamentoCanaisComTrafego = currentFaturamentoIfood + currentFaturamentoSite;
    const roasTrafegoPago = !isNaN(trafegoPago) && trafegoPago !== 0 ? faturamentoCanaisComTrafego / trafegoPago : 0;

    setResults({
      faturamentoIfood: currentFaturamentoIfood, faturamentoSite: currentFaturamentoSite, faturamentoSalao: currentFaturamentoSalao,
      faturamentoTotal, totalDeducoes, receitaLiquida,
      freteTotal, impostoTotal, materiaPrimaTotal, gatewayTotal, outrosCVTotal, totalCV,
      margemContribuicaoValor, margemContribuicaoPerc,
      totalCustosFixosMensais, txV4Company: (isNaN(txV4Company)?0:txV4Company),
      resultadoOperacionalValor, resultadoOperacionalPerc,
      totalInvestimentos,
      resultadoLiquidoValor, resultadoLiquidoPerc,
      pontoEquilibrioValor, pontoEquilibrioPedidos, ticketMedioTotal: ticketMedioTotalCalculado, cac, roiMarketing, roasTrafegoPago,
      taxaConversaoIfood: parsedDreInputs.taxaConversaoIfood,
      taxaConversaoSiteProprio: parsedDreInputs.taxaConversaoSiteProprio,
      trafegoPagoDisplay: (isNaN(trafegoPago)?0:trafegoPago)
    });
  }, [dreInputs, assumptions]);

  const inputLayoutConfig = useMemo(() => [
    {
      id: 'faturamentoCanais', title: 'Faturamento por Canal', icon: <ShoppingCart />,
      channels: [
        { name: 'iFood', prefix: 'ifood', fields: [
          { name: 'ifoodPedidos', label: 'Nº Pedidos', type: 'number'},
          { name: 'ifoodTicketMedio', label: 'Ticket Médio', unit: 'R$', type: 'number'},
          { name: 'ifoodValorVendas', label: 'Valor Vendas', unit: 'R$', type: 'number'},
        ]},
        { name: 'Site Próprio', prefix: 'site', fields: [
          { name: 'sitePedidos', label: 'Nº Pedidos', type: 'number'},
          { name: 'siteTicketMedio', label: 'Ticket Médio', unit: 'R$', type: 'number'},
          { name: 'siteValorVendas', label: 'Valor Vendas', unit: 'R$', type: 'number'},
        ]},
        { name: 'Salão', prefix: 'salao', fields: [
          { name: 'salaoPedidos', label: 'Nº Pedidos', type: 'number'},
          { name: 'salaoTicketMedio', label: 'Ticket Médio', unit: 'R$', type: 'number'},
          { name: 'salaoValorVendas', label: 'Valor Vendas', unit: 'R$', type: 'number'},
        ]},
      ]
    },
    { id: 'investimentoAds', title: 'Investimento em Mídia', icon: <TrendingUp/>, fields: [ { name: 'trafegoPago', label: 'Tráfego Pago (Ads)', unit: 'R$'} ]},
    { id: 'custosFixosMensais', title: 'Outros Custos Fixos Mensais', icon: <Briefcase />, fields: [ { name: 'aluguel', label: 'Aluguel', unit: 'R$'}, { name: 'condominio', label: 'Condomínio', unit: 'R$'}, { name: 'iptu', label: 'IPTU', unit: 'R$'}, { name: 'agua', label: 'Água', unit: 'R$'}, { name: 'luz', label: 'Luz', unit: 'R$'}, { name: 'telefoneInternet', label: 'Telefone/Internet', unit: 'R$'}, { name: 'softwareGestao', label: 'Software Gestão', unit: 'R$'}, { name: 'contabilidade', label: 'Contabilidade', unit: 'R$'}, { name: 'proLabore', label: 'Pró-labore', unit: 'R$'}, { name: 'salarios', label: 'Salários', unit: 'R$'}, { name: 'encargos', label: 'Encargos', unit: 'R$'}, { name: 'beneficios', label: 'Benefícios', unit: 'R$'}, { name: 'outrosCustosFixos', label: 'Outros Custos Fixos Diversos', unit: 'R$'}, ]},
    { id: 'investimentosMensais', title: 'Investimentos (Capex Mensal)', icon: <TrendingUp />, fields: [ { name: 'capex', label: 'Capex do Mês', unit: 'R$', info: 'Investimentos em bens duráveis no mês.'}, ]},
    { id: 'metricasConversao', title: 'Métricas de Conversão (Referência)', icon: <Lightbulb />, fields: [ { name: 'taxaConversaoIfood', label: 'Tx. Conversão Ifood', unit: '%', info: '% visitantes Ifood -> pedido.'}, { name: 'taxaConversaoSiteProprio', label: 'Tx. Conversão Site', unit: '%', info: '% visitantes site -> pedido.'}, ]},
  ], []);

  return ( <div className="w-full"> <section id="kpi-cards" className="mb-8"> <h2 className="text-xl font-semibold text-gray-800 mb-4">Principais Indicadores</h2> <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6"> <DashboardCard title="Receita Bruta Total" value={results.faturamentoTotal} icon={<DollarSign size={20} />} /> <DashboardCard title="Lucro Operacional" value={results.resultadoOperacionalValor} icon={<TrendingUp size={20} />} /> <DashboardCard title="Lucro Líquido" value={results.resultadoLiquidoValor} icon={<TrendingUp size={20} />} /> <DashboardCard title="Margem de Lucro (%)" value={results.resultadoLiquidoPerc} icon={<Percent size={20} />} isPercentage={true} isCurrency={false} /> </div> </section> {viewMode === 'full' && ( <div className="lg:flex lg:space-x-8"> <div className="lg:w-2/5 xl:w-1/3"> <h3 className="text-lg font-semibold text-gray-700 mb-4">Entrada de Dados Mensais</h3> {inputLayoutConfig.map(section => ( section.channels ? ( <div key={section.id} className="mb-6 bg-white rounded-lg shadow-md overflow-hidden"> <button onClick={() => setActiveSection(activeSection === section.id ? null : section.id)} className={`w-full text-left text-md sm:text-lg font-semibold text-gray-700 p-3 sm:p-4 flex items-center justify-between hover:bg-gray-100 focus:outline-none ${activeSection === section.id ? 'rounded-t-lg' : 'rounded-lg'}`}> <div className="flex items-center">{React.cloneElement(section.icon, {className: `mr-2 text-v4-red`, size:18})} {section.title}</div> <span className={`transform transition-transform duration-200 ${activeSection === section.id ? 'rotate-180' : 'rotate-0'}`}>▼</span> </button> {activeSection === section.id && ( <div className="p-3 sm:p-4 border-t border-gray-200 space-y-4"> {section.channels.map(channel => ( <div key={channel.prefix} className="p-3 border rounded-md"> <p className="text-md font-medium text-gray-600 mb-2">{channel.name}</p> {channel.fields.map(field => ( <InputField key={field.name} {...field} value={dreInputs[field.name]} onChange={onDreInputChange} disabled={disabled} /> ))} </div> ))} </div> )} </div> ) : ( <div key={section.id} className="mb-6 bg-white rounded-lg shadow-md overflow-hidden"> <button onClick={() => setActiveSection(activeSection === section.id ? null : section.id)} className={`w-full text-left text-md sm:text-lg font-semibold text-gray-700 p-3 sm:p-4 flex items-center justify-between hover:bg-gray-100 focus:outline-none ${activeSection === section.id ? 'rounded-t-lg' : 'rounded-lg'}`}> <div className="flex items-center">{React.cloneElement(section.icon, {className: `mr-2 text-v4-red`, size:18})} {section.title}</div> <span className={`transform transition-transform duration-200 ${activeSection === section.id ? 'rotate-180' : 'rotate-0'}`}>▼</span> </button> {activeSection === section.id && ( <div className="p-3 sm:p-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-x-4"> {section.fields.map(field => <InputField key={field.name} {...field} value={dreInputs[field.name]} onChange={onDreInputChange} disabled={disabled} />)} </div> )} </div> ) ))} </div> <div className="lg:w-3/5 xl:w-2/3 mt-8 lg:mt-0"> <h3 className="text-lg font-semibold text-gray-700 mb-4">Resultados Calculados Detalhados</h3> <div className="bg-white p-3 sm:p-4 rounded-lg shadow-md space-y-2 sm:space-y-3"> <h4 className="text-md font-semibold text-gray-700 flex items-center"><DollarSign className="mr-2 text-v4-red" size={18}/>Receitas</h4> <CalculatedField label="Fat. Ifood" value={results.faturamentoIfood} /> <CalculatedField label="Fat. Site" value={results.faturamentoSite} /> <CalculatedField label="Fat. Salão" value={results.faturamentoSalao} /> <CalculatedField label="FATURAMENTO TOTAL (RECEITA BRUTA)" value={results.faturamentoTotal} /> <hr className="my-3"/> <h4 className="text-md font-semibold text-gray-700 flex items-center"><Percent className="mr-2 text-v4-red" size={18}/>Deduções da Receita Bruta</h4> <CalculatedField label="TOTAL DEDUÇÕES DIRETAS" value={results.totalDeducoes} info="Impostos sobre receita, se aplicável e não coberto por CV."/> <hr className="my-3"/> <CalculatedField label="RECEITA LÍQUIDA" value={results.receitaLiquida} /> <hr className="my-3"/> <h4 className="text-md font-semibold text-gray-700 flex items-center"><ShoppingCart className="mr-2 text-v4-red" size={18}/>Custos Variáveis (Baseado nas Premissas)</h4> <CalculatedField label="Frete Total" value={results.freteTotal} /> <CalculatedField label="Imposto por Venda (Total)" value={results.impostoTotal} /> <CalculatedField label="Matéria Prima/CMV (Total)" value={results.materiaPrimaTotal} /> <CalculatedField label="Gateway/Tx App (Total)" value={results.gatewayTotal} /> <CalculatedField label="Outros Custos Variáveis (Total)" value={results.outrosCVTotal} /> <CalculatedField label="TOTAL CUSTOS VARIÁVEIS (CV)" value={results.totalCV} /> <hr className="my-3"/> <h4 className="text-md font-semibold text-gray-700 flex items-center"><Target className="mr-2 text-v4-red" size={18}/>Margem de Contribuição</h4> <CalculatedField label="MARGEM DE CONTRIBUIÇÃO (R$)" value={results.margemContribuicaoValor} /> <CalculatedField label="MARGEM DE CONTRIBUIÇÃO (%)" value={results.margemContribuicaoPerc} isPercentage={true} isCurrency={false} info="Sobre Receita Bruta"/> <hr className="my-3"/> <h4 className="text-md font-semibold text-gray-700 flex items-center"><Briefcase className="mr-2 text-v4-red" size={18}/>Custos Fixos</h4> <CalculatedField label="Taxa V4 Company (Premissa)" value={results.txV4Company} /> <CalculatedField label="Investimento em Tráfego Pago" value={results.trafegoPagoDisplay} /> <CalculatedField label="TOTAL CUSTOS FIXOS (com Tx V4 e Tráfego)" value={results.totalCustosFixosMensais} /> <hr className="my-3"/> <h4 className="text-md font-semibold text-gray-700 flex items-center"><TrendingUp className="mr-2 text-v4-red" size={18}/>Resultados</h4> <CalculatedField label="R. OPERACIONAL (R$)" value={results.resultadoOperacionalValor} /> <CalculatedField label="R. OPERACIONAL (%)" value={results.resultadoOperacionalPerc} isPercentage={true} isCurrency={false} info="Sobre Receita Bruta"/> <CalculatedField label="Investimentos (Capex)" value={results.totalInvestimentos} /> <CalculatedField label="RESULTADO LÍQUIDO (R$)" value={results.resultadoLiquidoValor} /> <CalculatedField label="LUCRATIVIDADE (%)" value={results.resultadoLiquidoPerc} isPercentage={true} isCurrency={false} info="Sobre Receita Bruta"/> <hr className="my-3"/> <h4 className="text-md font-semibold text-gray-700 flex items-center"><FileText className="mr-2 text-v4-red" size={18}/>Outras Métricas</h4> <CalculatedField label="P. Equilíbrio (R$)" value={results.pontoEquilibrioValor} /> <CalculatedField label="P. Equilíbrio (Pedidos)" value={results.pontoEquilibrioPedidos} isCurrency={false} /> <CalculatedField label="Ticket Médio Total" value={results.ticketMedioTotal} /> <CalculatedField label="Tx. Conv. Ifood (Input)" value={results.taxaConversaoIfood} isPercentage={true} isCurrency={false}/> <CalculatedField label="Tx. Conv. Site (Input)" value={results.taxaConversaoSiteProprio} isPercentage={true} isCurrency={false}/> <CalculatedField label="CAC" value={results.cac} /> <CalculatedField label="ROI Marketing" value={results.roiMarketing} isPercentage={true} isCurrency={false}/> <CalculatedField label="ROAS Tráfego" value={results.roasTrafegoPago} isCurrency={false}/> </div> </div> </div> )} {viewMode === 'dashboardOnly' && ( <section id="charts-placeholder" className="mt-12"> <h2 className="text-xl font-semibold text-gray-800 mb-6">Análises Gráficas</h2> <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> <div className="bg-white p-6 rounded-lg shadow-md min-h-[300px] flex flex-col items-center justify-center text-center"><BarChartHorizontal size={48} className="text-gray-300 mb-4"/><p className="text-gray-600 font-semibold text-lg">Receita vs Despesas</p><p className="text-sm text-gray-400 mt-2">Visualização gráfica comparando<br/>as receitas e despesas totais.</p><p className="text-xs text-gray-400 mt-4">(Gráfico em desenvolvimento)</p></div> <div className="bg-white p-6 rounded-lg shadow-md min-h-[300px] flex flex-col items-center justify-center text-center"><FilePieChart size={48} className="text-gray-300 mb-4"/><p className="text-gray-600 font-semibold text-lg">Composição de Despesas</p><p className="text-sm text-gray-400 mt-2">Gráfico de pizza detalhando a proporção<br/>de cada categoria de custo.</p><p className="text-xs text-gray-400 mt-4">(Gráfico em desenvolvimento)</p></div> </div> </section> )} </div>);};

// --- Componente AssumptionsPage ---
const AssumptionsPage = ({ userId, selectedClientId, selectedClientName, clients, onClientChange, openModal }) => {
  const [assumptions, setAssumptions] = useState(initialAssumptions);
  const [isLoading, setIsLoading] = useState(false); const [isSaving, setIsSaving] = useState(false); const [error, setError] = useState('');
  const assumptionDocPath = useMemo(() => { if (!userId || !selectedClientId) return null; return `artifacts/${appId}/users/${userId}/clients/${selectedClientId}/assumptions/current`; }, [userId, selectedClientId]);
  useEffect(() => { if (!assumptionDocPath) { setAssumptions(initialAssumptions); return; } setIsLoading(true); const unsub = onSnapshot(doc(db, assumptionDocPath), (docSnap) => { if (docSnap.exists()) { setAssumptions({ ...initialAssumptions, ...docSnap.data() }); } else { setAssumptions(initialAssumptions); } setIsLoading(false); }, (err) => { console.error("Erro premissas:", err); setError("Falha premissas."); setIsLoading(false); }); return () => unsub(); }, [assumptionDocPath]);
  const handleAssumptionChange = (e) => { const { name, value } = e.target; setAssumptions(prev => ({ ...prev, [name]: value })); };
  const handleSaveAssumptions = async () => { if (!assumptionDocPath) { setError("Selecione um cliente."); return; } setIsSaving(true); setError(''); try { const dataToSave = Object.keys(assumptions).reduce((acc, key) => { const val = assumptions[key]; if (val === '' || val === null || val === undefined) acc[key] = ''; else { const numVal = parseFloat(String(val).replace(',', '.')); acc[key] = isNaN(numVal) ? val : numVal; } return acc; }, {}); await setDoc(doc(db, assumptionDocPath), dataToSave, { merge: true }); openModal("Sucesso", "Premissas foram salvas com sucesso!"); } catch (err) { console.error("Erro salvar premissas:", err); setError("Falha salvar premissas."); openModal("Erro", "Ocorreu uma falha ao salvar as premissas."); } finally { setIsSaving(false); } };
  const assumptionFields = [ { name: 'fretePorVenda', label: 'Frete por Venda', unit: 'R$', info: 'Custo médio de frete por cada venda/pedido.' }, { name: 'impostoPorVenda', label: 'Imposto por Venda (Fixo)', unit: 'R$', info: 'Valor fixo de imposto por venda (Ex: ICMS ST, etc.).' }, { name: 'materiaPrimaPorVenda', label: 'Matéria Prima/CMV por Venda', unit: 'R$', info: 'Custo dos insumos/produtos por cada venda.' }, { name: 'gatewayPorVenda', label: 'Gateway/Tx. Marketplace por Venda', unit: 'R$', info: 'Taxa da plataforma de venda ou processador de pagamento por venda.' }, { name: 'outrosCustosVariaveisPorVenda', label: 'Outros Custos Variáveis por Venda', unit: 'R$', info: 'Outros custos diretos que variam com cada venda.' }, { name: 'txV4Company', label: 'Taxa Fixa V4 Company', unit: 'R$', info: 'Fee mensal da assessoria V4 Company (custo fixo).' }, ];
  if (!userId) return <p className="text-center mt-10">Login necessário.</p>;
  return ( <div className="max-w-3xl mx-auto mt-2 p-4 sm:p-6 bg-white rounded-lg shadow-md"> <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center"><Archive className="mr-2 text-v4-red" />Premissas do Cliente</h2> <div className="mb-6"> <label htmlFor="clientSelectAssumptions" className="block text-sm font-medium text-gray-700 mb-1">Selecione o Cliente</label> <select id="clientSelectAssumptions" value={selectedClientId} onChange={onClientChange} className="block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-v4-red focus:border-v4-red sm:text-sm"> <option value="">-- Selecione --</option> {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)} </select> </div> {selectedClientId ? ( isLoading ? <p>Carregando premissas...</p> : <> {error && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4">{error}</p>} <p className="mb-4 text-gray-600">Defina os valores base para <strong className="text-gray-800">{selectedClientName}</strong>.</p> <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2"> {assumptionFields.map(field => ( <InputField key={field.name} {...field} value={assumptions[field.name]} onChange={handleAssumptionChange} /> ))} </div>
      <Button id="saveAssumptionsButton" onClick={handleSaveAssumptions} disabled={isSaving || isLoading} className="mt-6 w-full md:w-auto"> {isSaving ? <><Lightbulb size={18} className="mr-2 animate-spin"/> Salvando...</> : <><Save size={18} className="mr-2"/> Salvar Premissas</>} </Button>
    </>
  ) : ( <p className="text-gray-500 p-4 border border-dashed border-gray-300 rounded-md text-center"> Selecione um cliente para editar suas premissas. </p> )} </div>);};

// --- Componente ClientsPage ---
const ClientsPage = ({ userId, onClientSelect, openModal, closeModal }) => {
  const [clients, setClients] = useState([]); const [newClientName, setNewClientName] = useState(''); const [editingClient, setEditingClient] = useState(null); const [isLoading, setIsLoading] = useState(true); const [error, setError] = useState('');
  const clientsCollectionPath = `artifacts/${appId}/users/${userId}/clients`;
  useEffect(() => { if (!userId) { setIsLoading(false); setClients([]); return; } setIsLoading(true); const q = query(collection(db, clientsCollectionPath), orderBy("createdAt", "desc")); const unsub = onSnapshot(q, (snap) => { setClients(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setIsLoading(false); }, (err) => { console.error("Erro clientes:", err); setError("Não foi possível carregar."); setIsLoading(false); }); return () => unsub(); }, [userId, clientsCollectionPath]);
  const handleAddClient = async (e) => { e.preventDefault(); if (!newClientName.trim() || !userId) return; try { await addDoc(collection(db, clientsCollectionPath), { name: newClientName.trim(), createdAt: serverTimestamp() }); setNewClientName(''); setError(''); } catch (err) { console.error("Erro add cliente:", err); setError("Falha ao adicionar."); } };
  const handleUpdateClient = async (e) => { e.preventDefault(); if (!editingClient || !editingClient.name.trim() || !userId) return; try { await updateDoc(doc(db, clientsCollectionPath, editingClient.id), { name: editingClient.name.trim() }); setEditingClient(null); setError(''); } catch (err) { console.error("Erro att cliente:", err); setError("Falha ao atualizar."); } };
  
  const confirmDeleteClient = (client) => {
    openModal(
        "Confirmar Exclusão",
        <div>
            <p className="mb-6 text-gray-600">Tem certeza que deseja excluir o cliente "{client.name}"? Todas as suas premissas e DREs serão perdidos. Esta ação é irreversível.</p>
            <div className="flex justify-end space-x-3">
                <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
                <Button variant="danger" onClick={() => performDelete(client.id)}>Excluir</Button>
            </div>
        </div>
    );
  };
    
  const performDelete = async (clientId) => {
    closeModal();
    try { 
        await runTransaction(db, async (transaction) => { 
            const clientDocRef = doc(db, clientsCollectionPath, clientId); 
            const dresQuery = query(collection(db, `artifacts/${appId}/users/${userId}/dres`), where("clientId", "==", clientId)); 
            const dresSnap = await getDocs(dresQuery); 
            dresSnap.forEach(dreDoc => transaction.delete(dreDoc.ref)); 
            const assumptionDocRef = doc(db, `artifacts/${appId}/users/${userId}/clients/${clientId}/assumptions/current`); 
            transaction.delete(assumptionDocRef); 
            transaction.delete(clientDocRef); 
        }); 
        setError(''); 
    } catch (err) { 
        console.error("Erro excluir cliente:", err); 
        setError("Falha ao excluir o cliente."); 
    }
  };

  if (!userId) return <p className="text-center mt-10">Login necessário.</p>; if (isLoading) return <p className="text-center mt-10">Carregando...</p>;
  return ( <div className="max-w-3xl mx-auto mt-2 p-4 sm:p-6 bg-white rounded-lg shadow-md"> <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center"><Building className="mr-2 text-v4-red" />Gerenciar Clientes</h2> {error && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4">{error}</p>} <form onSubmit={editingClient ? handleUpdateClient : handleAddClient} className="mb-8 p-4 border rounded-md"> <h3 className="text-lg font-medium mb-3">{editingClient ? "Editar" : "Adicionar Novo"}</h3> <InputField name="clientName" label="Nome da Empresa Cliente" type="text" value={editingClient ? editingClient.name : newClientName} onChange={(e) => editingClient ? setEditingClient({...editingClient, name: e.target.value}) : setNewClientName(e.target.value)} placeholder="Ex: Burger King" /> <div className="flex items-center space-x-2 mt-4"> <Button type="submit" variant="primary" disabled={editingClient ? !editingClient.name.trim() : !newClientName.trim()}>{editingClient ? <><Save size={18} className="mr-1"/> Salvar</> : <><PlusCircle size={18} className="mr-1"/> Adicionar</>}</Button> {editingClient && (<Button type="button" variant="secondary" onClick={() => setEditingClient(null)}><XCircle size={18} className="mr-1"/> Cancelar</Button>)} </div> </form> <h3 className="text-xl font-semibold mb-4">Meus Clientes</h3> {clients.length === 0 ? (<p className="text-gray-500">Nenhum cliente.</p>) : ( <ul className="space-y-3"> {clients.map(client => ( <li key={client.id} className="p-4 bg-gray-50 rounded-md shadow-sm flex flex-col sm:flex-row justify-between items-center hover:bg-gray-100"> <div className='w-full sm:w-auto text-center sm:text-left mb-4 sm:mb-0'> <p className="font-medium">{client.name}</p> {client.createdAt?.seconds && (<p className="text-xs text-gray-500">Desde: {new Date(client.createdAt.seconds * 1000).toLocaleDateString('pt-BR')}</p>)} </div> <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2"> <Button variant="outline" className="p-2 text-sm" onClick={() => onClientSelect(client.id, 'assumptions')} title="Premissas"><Archive size={16} className="mr-1"/> Premissas</Button> <Button variant="outline" className="p-2 text-sm" onClick={() => onClientSelect(client.id, 'dashboard')} title="DREs"><BarChart2 size={16} className="mr-1"/> DREs</Button> <Button variant="secondary" className="p-2" onClick={() => setEditingClient({id: client.id, name: client.name})} title="Editar"><Edit3 size={16} /></Button> <Button variant="danger" className="p-2" onClick={() => confirmDeleteClient(client)} title="Excluir"><Trash2 size={16} /></Button> </div> </li>))} </ul>)} </div>);};

// --- Componente PlaceholderPage ---
const PlaceholderPage = ({ title, icon }) => ( <div className="text-center text-gray-500 mt-20 p-6 bg-white rounded-lg shadow max-w-md mx-auto"> {React.cloneElement(icon, { size: 48, className: "mx-auto text-gray-400 mb-4" })} <h2 className="text-2xl font-semibold text-gray-700 mb-2">{title}</h2> <p>Esta seção está em desenvolvimento.</p> <p className="text-sm mt-1">Volte em breve para novidades!</p> </div>);

// --- Componente App principal ---
const App = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [userId, setUserId] = useState(null); const [authReady, setAuthReady] = useState(false);
  const [clients, setClients] = useState([]); const [selectedClientId, setSelectedClientId] = useState(''); const [selectedClientName, setSelectedClientName] = useState('');
  const [assumptions, setAssumptions] = useState(initialAssumptions);
  const [assumptionsLoading, setAssumptionsLoading] = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', content: null });
  
  const openModal = (title, content) => setModalConfig({ isOpen: true, title, content });
  const closeModal = () => setModalConfig({ isOpen: false, title: '', content: null });

  const currentYear = new Date().getFullYear(); const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const [selectedYear, setSelectedYear] = useState(currentYear); const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [dreInputs, setDreInputs] = useState(initialDreInputs);
  const [dreLoading, setDreLoading] = useState(false); const [dreError, setDreError] = useState(''); const [isSaving, setIsSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { const performSignIn = async () => { try { await setPersistence(auth, browserLocalPersistence); if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken); else await signInAnonymously(auth); } catch (error) { console.error("Auth Error:", error); }}; performSignIn(); const unsub = onAuthStateChanged(auth, (user) => { setUserId(user ? user.uid : null); setAuthReady(true); }); return () => unsub(); }, []);
  useEffect(() => { if (!userId) { setClients([]); setSelectedClientId(''); setSelectedClientName(''); return; } const q = query(collection(db, `artifacts/${appId}/users/${userId}/clients`), orderBy("name")); const unsub = onSnapshot(q, (snap) => { const cData = snap.docs.map(d => ({ id: d.id, name: d.data().name })); setClients(cData); if (selectedClientId) { const curSel = cData.find(c => c.id === selectedClientId); if (curSel) setSelectedClientName(curSel.name); else { setSelectedClientId(''); setSelectedClientName(''); } } }, (err) => console.error("Erro clientes:", err)); return () => unsub(); }, [userId, selectedClientId]);

  const assumptionDocPath = useMemo(() => { if (!userId || !selectedClientId) return null; return `artifacts/${appId}/users/${userId}/clients/${selectedClientId}/assumptions/current`; }, [userId, selectedClientId]);
  useEffect(() => { if (!assumptionDocPath) { setAssumptions(initialAssumptions); return; } setAssumptionsLoading(true); const unsub = onSnapshot(doc(db, assumptionDocPath), (docSnap) => { if (docSnap.exists()) setAssumptions({ ...initialAssumptions, ...docSnap.data() }); else setAssumptions(initialAssumptions); setAssumptionsLoading(false); }, (err) => { console.error("Erro premissas cliente:", err); setAssumptionsLoading(false);}); return () => unsub(); }, [assumptionDocPath]);
  const handleClientSelection = (clientId, targetPage = 'dashboard') => { setSelectedClientId(clientId); const cli = clients.find(c => c.id === clientId); if (cli) setSelectedClientName(cli.name); setCurrentPage(targetPage); setSidebarOpen(false); };
  const handleClientChangeForAssumptions = (e) => { const newClientId = e.target.value; setSelectedClientId(newClientId); const cli = clients.find(c => c.id === newClientId); if (cli) setSelectedClientName(cli.name);};

  const dreDocId = useMemo(() => { if (!selectedClientId || !selectedYear || !selectedMonth) return null; return `${selectedClientId}_${selectedYear}_${selectedMonth}`; }, [selectedClientId, selectedYear, selectedMonth]);
  
  const debouncedSaveDre = useMemo(() => debounce(async (inputsToSave) => {
        if (!userId || !dreDocId || dreLoading || assumptionsLoading) return;
        const allDef = Object.values(inputsToSave).every(v => v === '' || v === 0 || v === '0' || isNaN(parseToNumber(v)));
        const dRef = doc(db, `artifacts/${appId}/users/${userId}/dres/${dreDocId}`);
        const dSnap = await getDoc(dRef);
        if (allDef && !dSnap.exists()) {
            console.log("Novo DRE vazio, não salvando.");
            return;
        }
        setIsSaving(true);
        setDreError('');
        try {
            await setDoc(dRef, {
                clientId: selectedClientId,
                year: selectedYear,
                month: selectedMonth,
                inputs: inputsToSave,
                updatedAt: serverTimestamp(),
                createdAt: dSnap.exists() ? dSnap.data().createdAt || serverTimestamp() : serverTimestamp()
            }, { merge: true });
            console.log("DRE salvo:", dreDocId);
        } catch (err) {
            console.error("Erro salvar DRE:", err);
            setDreError("Falha ao salvar o DRE.");
        } finally {
            setIsSaving(false);
        }
    }, 1500),
    [userId, dreDocId, selectedClientId, selectedYear, selectedMonth, dreLoading, assumptionsLoading]
  );
  
  useEffect(() => {
    return () => {
        debouncedSaveDre.cancel();
    }
  }, [debouncedSaveDre]);

  useEffect(() => { if (!userId || !dreDocId) { setDreInputs(initialDreInputs); setDreLoading(false); return; } setDreLoading(true); setDreError(''); const path = `artifacts/${appId}/users/${userId}/dres/${dreDocId}`; const unsub = onSnapshot(doc(db, path), (snap) => { if (snap.exists()) setDreInputs({ ...initialDreInputs, ...snap.data().inputs }); else setDreInputs(initialDreInputs); setDreLoading(false); }, (err) => { console.error("Erro DRE:", err); setDreError("Falha DRE."); setDreLoading(false); }); return () => unsub(); }, [userId, dreDocId]);
  
  const handleDreInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setDreInputs(prevInputs => {
      let updatedInputs = { ...prevInputs, [name]: value };
      const channelPrefix = name.match(/^(ifood|site|salao)/)?.[0];

      if (channelPrefix) {
        const pedidosKey = `${channelPrefix}Pedidos`;
        const ticketKey = `${channelPrefix}TicketMedio`;
        const valorKey = `${channelPrefix}ValorVendas`;

        let pedidosNum = parseToNumber(updatedInputs[pedidosKey]);
        let ticketNum = parseToNumber(updatedInputs[ticketKey]);
        let valorNum = parseToNumber(updatedInputs[valorKey]);
        
        const sourceField = name;

        if (sourceField === pedidosKey || sourceField === ticketKey) {
          if (!isNaN(pedidosNum) && !isNaN(ticketNum)) {
            valorNum = pedidosNum * ticketNum;
            updatedInputs[valorKey] = isNaN(valorNum) ? '' : valorNum.toFixed(2);
          }
        } else if (sourceField === valorKey) {
          if (!isNaN(valorNum) && !isNaN(pedidosNum) && pedidosNum > 0) {
            ticketNum = valorNum / pedidosNum;
            updatedInputs[ticketKey] = isNaN(ticketNum) ? '' : ticketNum.toFixed(2);
          } else if (!isNaN(valorNum) && !isNaN(ticketNum) && ticketNum > 0) {
            pedidosNum = valorNum / ticketNum;
            updatedInputs[pedidosKey] = isNaN(pedidosNum) ? '' : Math.round(pedidosNum).toString();
          }
        }
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
    const commonDrePageSetup = (viewMode) => ( <> <div className="mb-6 p-4 bg-white rounded-lg shadow-md"> <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"> <div> <label htmlFor={`clientSelect-${viewMode}`} className="block text-sm font-medium text-gray-700 mb-1">Cliente Ativo</label> <select id={`clientSelect-${viewMode}`} value={selectedClientId} onChange={(e) => { const newClientId = e.target.value; setSelectedClientId(newClientId); const client = clients.find(c => c.id === newClientId); if (client) setSelectedClientName(client.name);}} className="block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-v4-red focus:border-v4-red sm:text-sm" disabled={clients.length === 0}> <option value="">{clients.length === 0 ? "Nenhum cliente" : "Mudar Cliente..."}</option> {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)} </select> </div> <div> <label htmlFor={`yearSelect-${viewMode}`} className="block text-sm font-medium text-gray-700 mb-1">Ano</label> <input type="number" id={`yearSelect-${viewMode}`} value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-v4-red focus:border-v4-red sm:text-sm" placeholder="AAAA" min="2000" max="2100"/> </div> <div> <label htmlFor={`monthSelect-${viewMode}`} className="block text-sm font-medium text-gray-700 mb-1">Mês</label> <select id={`monthSelect-${viewMode}`} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-v4-red focus:border-v4-red sm:text-sm">{Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(month => <option key={month} value={month}>{month}</option>)}</select> </div> </div> {dreError && <p className="text-red-500 mt-2 text-sm">{dreError}</p>} {isSaving && <p className="text-blue-500 mt-2 text-sm animate-pulse">Salvando DRE...</p>} </div> {(dreLoading || assumptionsLoading) ? <p className="text-center text-gray-600 mt-10 text-lg">Carregando dados...</p> : <DreCalculator dreInputs={dreInputs} assumptions={assumptions} onDreInputChange={handleDreInputChange} disabled={!selectedClientId || dreLoading || assumptionsLoading} viewMode={viewMode} />} </> );
    const noClientSelectedMessage = ( <div className="text-center text-gray-500 mt-10 p-6 bg-white rounded-lg shadow max-w-lg mx-auto"> <Users size={48} className="mx-auto text-gray-400 mb-4" /> <p className="text-xl">Nenhum cliente selecionado.</p> <p className="mt-2">Vá para "Clientes" para cadastrar/selecionar, ou escolha um na lista acima.</p> <Button onClick={() => setCurrentPage('clients')} variant="primary" className="mt-4 mx-auto">Ir para Clientes</Button> </div> );
    switch (currentPage) {
      case 'dashboard': return selectedClientId ? commonDrePageSetup('dashboardOnly') : noClientSelectedMessage;
      case 'dre': return selectedClientId ? commonDrePageSetup('full') : noClientSelectedMessage;
      case 'assumptions': return <AssumptionsPage userId={userId} selectedClientId={selectedClientId} selectedClientName={selectedClientName} clients={clients} onClientChange={handleClientChangeForAssumptions} openModal={openModal}/>;
      case 'clients': return <ClientsPage userId={userId} onClientSelect={handleClientSelection} openModal={openModal} closeModal={closeModal} />;
      case 'reports': return <PlaceholderPage title="Relatórios" icon={<FilePieChart/>}/>;
      case 'analysis': return <PlaceholderPage title="Análise" icon={<BarChartHorizontal/>}/>;
      case 'help': return <PlaceholderPage title="Ajuda" icon={<HelpCircle/>}/>;
      case 'settings': return <PlaceholderPage title="Configurações" icon={<Settings/>}/>;
      default: return <PlaceholderPage title="Página não encontrada" icon={<XCircle/>}/>;
    }
  };
  return ( 
  <div className="flex h-screen bg-gray-100 font-sans"> 
    <Modal isOpen={modalConfig.isOpen} onClose={closeModal} title={modalConfig.title}>
        {typeof modalConfig.content === 'string' ? <p>{modalConfig.content}</p> : modalConfig.content}
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
            <h2 className="text-lg sm:text-xl font-semibold text-gray-700 truncate"> {selectedClientId && (currentPage === 'dashboard' || currentPage === 'dre' || currentPage === 'assumptions') ? `${selectedClientName || 'Cliente'} - ${currentPage === 'assumptions' ? 'Premissas' : `${selectedMonth}/${selectedYear}`}` : navigationItems.find(nav => nav.id === currentPage)?.label || bottomNavigationItems.find(nav => nav.id === currentPage)?.label || "Dashboard"} </h2> 
            {(currentPage === 'dashboard' || currentPage === 'dre' || currentPage === 'assumptions') && selectedClientId && <Edit3 size={18} className="ml-2 text-gray-400 hover:text-v4-red cursor-pointer flex-shrink-0" title="Mudar Cliente" onClick={() => setCurrentPage('clients')}/> } 
          </div> 
          <div className="flex items-center space-x-2 sm:space-x-3"> 
            <Button variant="secondary" className="text-sm py-1.5 px-2 sm:px-3" id="headerSaveButton" onClick={() => { 
                if (currentPage === 'assumptions' && selectedClientId) { 
                    const saveAssumptionsBtn = document.getElementById('saveAssumptionsButton'); 
                    if (saveAssumptionsBtn) saveAssumptionsBtn.click(); 
                    else openModal("Erro", "Não foi possível encontrar a função para salvar.");
                } else if (selectedClientId && dreDocId && (currentPage === 'dre' || currentPage === 'dashboard')) { 
                    debouncedSaveDre.flush(); 
                    openModal("Sucesso", "O DRE foi salvo manualmente!");
                } else { 
                    openModal("Atenção", "Selecione um cliente e um período para poder salvar, ou navegue para a página de premissas de um cliente.");
                } 
            }}> <Save size={16} className="mr-0 sm:mr-1.5"/> <span className="hidden sm:inline">Salvar</span> </Button> 
            <Button variant="primary" className="text-sm py-1.5 px-2 sm:px-3" onClick={() => openModal("Não Implementado", "A função de exportar será adicionada em breve.")}> <FileText size={16} className="mr-0 sm:mr-1.5"/> <span className="hidden sm:inline">Exportar</span></Button> 
          </div> 
        </div> 
      </header> 
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 sm:p-6"> {renderPageContent()} </main> 
    </div> 
  </div> );
};

export default App;
