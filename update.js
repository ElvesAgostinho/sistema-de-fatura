const fs = require('fs');
const path = 'c:/Users/DELL/Desktop/SISTEMA DE FATURA/angola-billing-system/components/views/pos-view.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { supabase }')) {
  content = content.replace(
    `import { toast } from 'sonner';`,
    `import { toast } from 'sonner';\nimport { supabase } from '@/lib/supabase/client';\nimport { ClipboardList } from 'lucide-react';`
  );
}

const shiftHistoryModalCode = `
/* ─── ShiftHistoryModal — Histórico do Turno ──────────────────────────────── */
function ShiftHistoryModal({
  sessionId, onClose, touchMode
}: {
  sessionId: string; onClose: () => void; touchMode: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    count: 0,
    avg: 0,
    opening: 0,
    cashIn: 0,
    cashOut: 0,
    operator: '',
    openedAt: '',
  });
  const [sales, setSales] = useState<any[]>([]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase
        .from('pos_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
        
      if (sessionData) {
        setStats(prev => ({ ...prev, opening: sessionData.opening_balance, operator: sessionData.operator_name || 'Operador', openedAt: sessionData.opened_at }));
      }

      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('*')
        .eq('session_id', sessionId)
        .eq('status', 'paid')
        .order('created_at', { ascending: false });

      if (invoicesData) {
        setSales(invoicesData.slice(0, 10)); // Top 10
        const total = invoicesData.reduce((acc, curr) => acc + (curr.total || 0), 0);
        const count = invoicesData.length;
        setStats(prev => ({
          ...prev,
          total,
          count,
          avg: count > 0 ? total / count : 0
        }));
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const MetricCard = ({ title, value }: { title: string, value: string }) => (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center">
      <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">{title}</span>
      <span className="text-xl font-black text-slate-800 tabular-nums">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6" style={{ background: 'rgba(9,60,90,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-[#F4F5F8] w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ height: '85vh' }}>
        
        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center bg-[#0b4a6f] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#13b5ea]">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white font-black text-xl leading-tight">Histórico do Turno</h2>
              <p className="text-white/70 text-xs">Acompanhamento de vendas em tempo real</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-[#13b5ea]" />
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
                <MetricCard title="Total Vendido" value={stats.total.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })} />
                <MetricCard title="Nº Faturas" value={stats.count.toString()} />
                <MetricCard title="Ticket Médio" value={stats.avg.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })} />
                <MetricCard title="Fundo Inicial" value={stats.opening.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })} />
                <MetricCard title="Operador" value={stats.operator} />
                <MetricCard title="Abertura" value={stats.openedAt ? new Date(stats.openedAt).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' }) : '-'} />
                <MetricCard title="Saldo em Caixa" value={(stats.total + stats.opening).toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })} />
                <div className="bg-[#13b5ea]/10 rounded-xl p-4 border border-[#13b5ea]/20 shadow-sm flex flex-col justify-center items-center cursor-pointer hover:bg-[#13b5ea]/20 transition" onClick={fetchHistory}>
                  <RefreshCw className="w-6 h-6 text-[#13b5ea] mb-2" />
                  <span className="text-xs text-[#0b4a6f] font-bold uppercase tracking-wider">Atualizar Dados</span>
                </div>
              </div>

              {/* Latest Sales */}
              <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="font-bold text-[#0b4a6f] text-sm flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Últimas 10 Vendas
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {sales.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 font-medium">Nenhuma venda registada neste turno.</div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100">
                          <th className="px-5 py-3">Doc</th>
                          <th className="px-5 py-3">Hora</th>
                          <th className="px-5 py-3">Cliente</th>
                          <th className="px-5 py-3">Pagamento</th>
                          <th className="px-5 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.map((s, i) => (
                          <tr key={s.id} className={\`border-b border-slate-50 hover:bg-slate-50 transition \${touchMode ? 'text-sm' : 'text-xs'}\`}>
                            <td className="px-5 py-3.5 font-bold text-[#0b4a6f]">{s.document_type || 'FR'} {s.number}</td>
                            <td className="px-5 py-3.5 text-slate-600 font-medium">{new Date(s.created_at).toLocaleTimeString('pt-AO')}</td>
                            <td className="px-5 py-3.5 text-slate-800">{s.customer_name || 'Consumidor Final'}</td>
                            <td className="px-5 py-3.5">
                              <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">
                                {s.payment_method || 'Numerário'}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right font-black tabular-nums text-slate-800">
                              {(s.total || 0).toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
`;

const sessionModalReplacement = `/* ─── SessionModal — Abrir Caixa ──────────────────────────────────────────── */
function SessionModal({
  onOpen, onClose, isCaixa = false,
}: {
  onOpen: (n: string, b: number) => void;
  onClose: () => void;
  isCaixa?: boolean;
}) {
  const [name,    setName]    = useState('Caixa 1');
  const [balance, setBalance] = useState('');
  const [opening, setOpening] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const TERMINALS     = ['Caixa 1', 'Caixa 2', 'Caixa 3', 'Caixa 4'];
  const QUICK_AMOUNTS = [5000, 10000, 20000, 50000, 100000, 200000];
  const NUMPAD        = ['7','8','9','4','5','6','1','2','3','000','0','⌫'];

  const numpadPress = (val: string) => {
    if ('vibrate' in navigator) navigator.vibrate(20);
    setBalance(prev => {
      if (val === '⌫') return prev.slice(0, -1);
      if (val === '000') return prev + '000';
      return prev + val;
    });
  };

  const balanceNum = parseFloat(balance) || 0;

  const handleConfirmClick = () => {
    if ('vibrate' in navigator) navigator.vibrate(30);
    setShowConfirm(true);
  };

  const executeOpen = async () => {
    if (opening) return;
    if ('vibrate' in navigator) navigator.vibrate(50);
    setOpening(true);
    await onOpen(name, balanceNum);
    setOpening(false);
    setShowConfirm(false);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onClose();
    }, 2000);
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0b4a6f]">
        <div className="flex flex-col items-center animate-in zoom-in duration-300">
          <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(37,183,232,0.4)]">
            <CheckCircle2 className="w-12 h-12 text-[#25b7e8]" />
          </div>
          <h2 className="text-3xl font-black text-white mb-2">Turno Iniciado!</h2>
          <p className="text-[#25b7e8] font-medium text-lg">{name} pronto a operar</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(9,60,90,0.9)', backdropFilter: 'blur(8px)' }}
      onClick={isCaixa ? undefined : onClose}
    >
      <div
        className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-5 shrink-0 bg-[#0b4a6f] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#25b7e8]">
            <Calculator className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="text-white font-black text-2xl">Abrir Caixa</h3>
            <p className="text-white/70 text-sm mt-0.5">Declare o fundo inicial para começar o turno</p>
          </div>
        </div>

        {/* Content (Two Columns on md+) */}
        <div className="flex flex-col md:flex-row bg-[#F4F5F8]">
          
          {/* LEFT COLUMN: Info */}
          <div className="md:w-5/12 p-8 flex flex-col gap-8 bg-white border-r border-slate-100">
            
            {/* Terminal selector */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-3 block text-slate-500">
                Selecione o Terminal
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TERMINALS.map(t => (
                  <button
                    key={t}
                    onClick={() => { if('vibrate' in navigator) navigator.vibrate(20); setName(t); }}
                    className="py-4 rounded-xl text-sm font-black border-2 transition-all active:scale-95"
                    style={{
                      background:  name === t ? '#0b4a6f' : '#fff',
                      borderColor: name === t ? '#0b4a6f' : '#e2e8f0',
                      color:       name === t ? '#fff' : '#475569',
                      boxShadow:   name === t ? '0 4px 12px rgba(11,74,111,0.2)' : 'none'
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Operator Info */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
              <label className="text-[10px] font-bold uppercase tracking-wider mb-4 block text-slate-400">Dados da Sessão</label>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Operador</span>
                  <span className="text-sm font-bold text-[#0b4a6f]">Sessão Atual</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Data</span>
                  <span className="text-sm font-bold text-slate-700">{now.toLocaleDateString('pt-AO')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Hora</span>
                  <span className="text-sm font-bold text-slate-700">{now.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-4">
               <button
                onClick={onClose}
                className="w-full py-4 rounded-xl text-sm font-bold border transition-colors hover:bg-slate-50 text-slate-500 border-slate-200"
              >
                Voltar ao Dashboard
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Value & Numpad */}
          <div className="md:w-7/12 p-8 flex flex-col gap-6">
            
            {/* Amount display */}
            <div className="bg-white rounded-2xl border-2 px-6 py-5 text-right shadow-sm relative overflow-hidden"
                 style={{ borderColor: balanceNum > 0 ? '#25b7e8' : '#e2e8f0' }}>
              <div className="absolute top-4 left-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Fundo Inicial</div>
              <p className="text-5xl lg:text-6xl font-black tabular-nums tracking-tight mt-6" style={{ color: balanceNum > 0 ? '#0b4a6f' : '#cbd5e1' }}>
                <span className="text-2xl lg:text-3xl font-bold mr-2 text-slate-400">Kz</span>
                {balanceNum > 0 ? balanceNum.toLocaleString('pt-AO') : '0'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
              {/* Quick amounts */}
              <div className="grid grid-cols-2 gap-2 content-start">
                {QUICK_AMOUNTS.map(a => (
                  <button
                    key={a}
                    onClick={() => { if('vibrate' in navigator) navigator.vibrate(20); setBalance(String(a)); }}
                    className="py-4 rounded-xl text-sm font-black border transition-all active:scale-95 bg-white hover:bg-[#25b7e8]/5 text-[#0b4a6f] border-[#25b7e8]/20"
                  >
                    {a >= 1000 ? \`\${a / 1000}k\` : a}
                  </button>
                ))}
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2 content-start">
                {NUMPAD.map(k => (
                  <button
                    key={k}
                    onClick={() => numpadPress(k)}
                    className="rounded-xl font-black text-xl border transition-all active:scale-95 active:shadow-inner flex items-center justify-center bg-white"
                    style={{
                      borderColor: k === '⌫' ? '#fca5a5' : '#e2e8f0',
                      color:       k === '⌫' ? '#ef4444' : '#1e293b',
                      minHeight:   '60px',
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleConfirmClick}
              className="w-full rounded-2xl font-black text-xl text-white transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-3 shadow-xl mt-auto"
              style={{ background: '#25b7e8', minHeight: '64px' }}
            >
              <CheckCircle2 className="w-6 h-6" /> Iniciar Turno
            </button>
          </div>
        </div>

        {/* Confirmation Modal Layer */}
        {showConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-white/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white border shadow-2xl rounded-2xl w-full max-w-sm p-6 flex flex-col relative">
              <h3 className="text-xl font-black text-[#0b4a6f] mb-6 text-center">Confirmar Abertura</h3>
              
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Terminal</span>
                  <span className="text-sm font-bold text-slate-800">{name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Fundo Inicial</span>
                  <span className="text-lg font-black text-[#0b4a6f]">{balanceNum.toLocaleString('pt-AO')} Kz</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={opening}
                  className="py-3.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={executeOpen}
                  disabled={opening}
                  className="py-3.5 rounded-xl text-sm font-black text-white bg-[#0b4a6f] flex items-center justify-center"
                >
                  {opening ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}`;

let newContent = content.replace(/\/\* ─── SessionModal — Abrir Caixa ───[\s\S]*?(?=\/\* ─── DiscountModal)/, shiftHistoryModalCode + '\n' + sessionModalReplacement + '\n');

if (!newContent.includes('const [showHistory, setShowHistory] = useState(false);')) {
  newContent = newContent.replace(
    'const [showSession, setShowSession] = useState(false);',
    'const [showSession, setShowSession] = useState(false);\n  const [showHistory, setShowHistory] = useState(false);'
  );
}

if (!newContent.includes('showHistory && session && (')) {
  newContent = newContent.replace(
    '{/* ── TOP BAR ────────────────────────────────────────────────────────── */}',
    `{showHistory && session && (
        <ShiftHistoryModal 
          sessionId={session.id} 
          onClose={() => setShowHistory(false)} 
          touchMode={touchMode} 
        />
      )}
      
      {/* ── TOP BAR ────────────────────────────────────────────────────────── */}`
  );
}

if (!newContent.includes('setShowHistory(true)')) {
  newContent = newContent.replace(
    `{session.terminal_name}\n          </span>`,
    `{session.terminal_name}\n          </span>\n          <button\n            onClick={() => setShowHistory(true)}\n            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full ml-2 transition-opacity hover:opacity-80"\n            style={{ background: '#25b7e820', color: '#13b5ea', border: '1px solid #25b7e840' }}\n          >\n            <ClipboardList className="w-3 h-3" />\n            Histórico\n          </button>`
  );
}

fs.writeFileSync(path, newContent, 'utf8');
console.log('Update successful');
