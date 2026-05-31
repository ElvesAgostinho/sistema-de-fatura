import Link from 'next/link';
import { FileText, ShieldCheck, Lock, Zap, Check, ArrowRight, BarChart3, Users } from 'lucide-react';

export default function LandingPage() {
  const features = [
    { icon: ShieldCheck, title: 'Compliance AGT', desc: 'Numeração sequencial, hash SHA-256 encadeado e auditoria completa conforme a lei angolana.' },
    { icon: Lock, title: 'Segurança Total', desc: 'Faturas imutáveis após emissão, isolamento multi-empresa (RLS) e validação de integridade.' },
    { icon: Zap, title: 'Rápido & Simples', desc: 'Emita uma fatura em segundos. Interface limpa, moderna, estilo Microsoft 365.' },
    { icon: BarChart3, title: 'Dashboard em Tempo Real', desc: 'Receita mensal, IVA acumulado e estatísticas visuais da sua faturação.' },
    { icon: FileText, title: 'PDFs Profissionais', desc: 'Geração automática de PDFs com cabeçalho, NIF, hash e rodapé legal AGT.' },
    { icon: Users, title: 'Multi-Empresa', desc: 'Cada empresa tem os seus dados isolados. Pronto para venda SaaS.' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
            <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <span>FaturaAO</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2">Entrar</Link>
            <Link href="/register" className="ms-btn-primary">
              Começar <ArrowRight className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-[1200px] mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium mb-6">
          <ShieldCheck className="w-3.5 h-3.5" /> Certificado para compliance AGT
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Faturação <span className="text-primary">profissional</span><br/> para empresas angolanas
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Emita faturas, fatura-recibos e notas de crédito em conformidade total com a AGT. 
          Numeração sequencial, hash encadeado, valores em Kwanza (AOA) e IVA automático.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/register" className="ms-btn-primary px-6 py-3 text-base">
            Criar conta grátis <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/login" className="px-6 py-3 text-base font-medium text-foreground hover:bg-secondary rounded-md transition">
            Já tenho conta
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-secondary/50 py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Tudo o que precisa para faturar</h2>
            <p className="text-muted-foreground">Construído especificamente para o mercado angolano</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features?.map((f, i) => {
              const Icon = f?.icon;
              return (
                <div key={i} className="ms-card p-6">
                  <div className="w-10 h-10 rounded bg-accent text-accent-foreground flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold mb-2">{f?.title}</h3>
                  <p className="text-sm text-muted-foreground">{f?.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Compliance */}
      <section className="max-w-[1200px] mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-4">Compliance <span className="text-primary">AGT</span> garantido</h2>
            <p className="text-muted-foreground mb-6">Cada fatura emitida cumpre integralmente os requisitos da Administração Geral Tributária.</p>
            <ul className="space-y-3">
              {['Numeração sequencial por série e ano (FT 2026/0001)','Hash SHA-256 encadeado (blockchain-style)','Imutabilidade das faturas emitidas','Sistema de anulação com motivo obrigatório','Registo completo de auditoria','NIF obrigatório em todas as faturas','IVA 14% com opção de isenção justificada'].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-success text-success-foreground flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="ms-card p-8 bg-gradient-to-br from-primary/5 to-accent">
            <div className="font-mono text-xs text-muted-foreground mb-2">Exemplo de fatura</div>
            <div className="font-mono text-2xl font-bold mb-1">FT 2026/0042</div>
            <div className="font-mono text-xs text-muted-foreground break-all">hash: 7a9b3c4d5e...f8912</div>
            <div className="my-6 h-px bg-border" />
            <div className="flex justify-between text-sm mb-2"><span>Subtotal</span><span className="font-mono">50.000,00 Kz</span></div>
            <div className="flex justify-between text-sm mb-2"><span>IVA (14%)</span><span className="font-mono">7.000,00 Kz</span></div>
            <div className="flex justify-between text-base font-bold mt-3 pt-3 border-t"><span>Total</span><span className="font-mono text-primary">57.000,00 Kz</span></div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 bg-secondary/30">
        <div className="max-w-[1200px] mx-auto px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} FaturaAO &middot; Sistema de faturação para Angola &middot; Compliance AGT
        </div>
      </footer>
    </div>
  );
}
