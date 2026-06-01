import './landing.css';
'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import {
  FileText, ShieldCheck, Lock, Zap, Check, ArrowRight,
  BarChart3, Users, ChevronDown, Star, Menu, X,
  Globe, TrendingUp, Award, Clock, Database, Layers
} from 'lucide-react';

// ─── Animation hook ────────────────────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ─── Counter animation ─────────────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView();
  useEffect(() => {
    if (!inView) return;
    const duration = 1800;
    const steps = 60;
    const inc = target / steps;
    let cur = 0;
    const timer = setInterval(() => {
      cur = Math.min(cur + inc, target);
      setCount(Math.floor(cur));
      if (cur >= target) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, target]);
  return <span ref={ref}>{prefix}{count.toLocaleString('pt-AO')}{suffix}</span>;
}

// ─── Feature Card ──────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, delay }: { icon: any; title: string; desc: string; delay: number }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className="feature-card"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      <div className="feature-icon-wrap">
        <Icon className="w-6 h-6" />
      </div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

// ─── Pricing Card ──────────────────────────────────────────────────────────────
function PricingCard({
  name, price, priceYear, desc, features, cta, ctaLink, highlighted, delay
}: {
  name: string; price: string; priceYear: string; desc: string;
  features: string[]; cta: string; ctaLink: string;
  highlighted?: boolean; delay: number;
}) {
  const { ref, inView } = useInView();
  const [annual, setAnnual] = useState(false);
  return (
    <div
      ref={ref}
      className={`pricing-card ${highlighted ? 'pricing-card--highlight' : ''}`}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {highlighted && <div className="pricing-badge">Mais popular</div>}
      <div className="pricing-name">{name}</div>
      <div className="pricing-price">
        <span className="pricing-amount">{annual ? priceYear : price}</span>
        <span className="pricing-period">/mês</span>
      </div>
      {priceYear !== price && (
        <button className="pricing-toggle" onClick={() => setAnnual(!annual)}>
          {annual ? '▼ Mensal' : '▲ Anual (-20%)'}
        </button>
      )}
      <p className="pricing-desc">{desc}</p>
      <ul className="pricing-features">
        {features.map((f, i) => (
          <li key={i}>
            <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link href={ctaLink} className={`pricing-cta ${highlighted ? 'pricing-cta--highlight' : ''}`}>
        {cta} <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const features = [
    { icon: ShieldCheck, title: 'Compliance AGT Total', desc: 'Hash SHA-256 encadeado, numeração sequencial certificada e auditoria completa. Zero riscos fiscais.' },
    { icon: Lock, title: 'Imutabilidade Garantida', desc: 'Faturas protegidas por triggers PL/pgSQL. Impossível alterar após emissão — exigência legal cumprida.' },
    { icon: Zap, title: 'Emissão em 3 Segundos', desc: 'Interface ultra-rápida. Selecione o cliente, adicione itens, emita. Simples como deve ser.' },
    { icon: BarChart3, title: 'Dashboard em Tempo Real', desc: 'Receita mensal, IVA acumulado, faturas pendentes. Tudo numa vista clara e moderna.' },
    { icon: FileText, title: 'PDFs Profissionais', desc: 'Documentos com logótipo, NIF, QR Code de verificação, hash e rodapé legal AGT automático.' },
    { icon: Users, title: 'Multi-Empresa', desc: 'Dados de cada empresa 100% isolados por Row Level Security. Pronto para crescer.' },
    { icon: Globe, title: 'Todos os Documentos AGT', desc: 'FT, FR, NC, ND, RC, PP e GT. Cobrimos todos os tipos de documentos fiscais angolanos.' },
    { icon: Database, title: 'SAF-T Angola', desc: 'Exportação de ficheiros SAF-T prontos para submissão à AGT com um clique.' },
    { icon: Layers, title: 'Gestão de Stocks', desc: 'Controlo automático de inventário ligado às vendas. Nunca venda o que não tem.' },
  ];

  const stats = [
    { label: 'Faturas emitidas', value: 48200, suffix: '+' },
    { label: 'Empresas ativas', value: 312, suffix: '+' },
    { label: 'Uptime garantido', value: 99, suffix: '.9%', prefix: '' },
    { label: 'Conformidade AGT', value: 100, suffix: '%' },
  ];

  const plans = [
    {
      name: 'Gratuito',
      price: '0 Kz',
      priceYear: '0 Kz',
      desc: 'Para testar e pequenos negócios',
      features: ['50 faturas/mês', '1 utilizador', 'PDFs básicos', 'Compliance AGT', 'Suporte por email'],
      cta: 'Começar grátis',
      ctaLink: '/register',
    },
    {
      name: 'Profissional',
      price: '15.000 Kz',
      priceYear: '12.000 Kz',
      desc: 'Para PMEs em crescimento',
      features: ['Faturas ilimitadas', '5 utilizadores', 'PDFs com logótipo', 'SAF-T export', 'Dashboard avançado', 'Gestão de stocks', 'Suporte prioritário'],
      cta: 'Experimentar 14 dias',
      ctaLink: '/register',
      highlighted: true,
    },
    {
      name: 'Empresa',
      price: '45.000 Kz',
      priceYear: '36.000 Kz',
      desc: 'Para grandes organizações',
      features: ['Tudo do Profissional', 'Utilizadores ilimitados', 'Multi-empresa', 'API REST', 'Integração ERP', 'Gestor de conta dedicado', 'SLA 99.9%'],
      cta: 'Falar com vendas',
      ctaLink: '/register',
    },
  ];

  const testimonials = [
    { name: 'Ana Rodrigues', company: 'TechLuanda Lda', text: 'Finalmente um sistema de faturação que cumpre a lei angolana sem ser complicado. Emitimos 200 faturas por mês em minutos.', stars: 5 },
    { name: 'Carlos Mendes', company: 'Grupo Bengo Import', text: 'O suporte à certificação AGT foi decisivo. Passámos na auditoria fiscal sem problemas. Recomendo a todos.', stars: 5 },
    { name: 'Yara Nzinga', company: 'Consultoria Kwanza', text: 'A migração do Excel foi simples e o dashboard de relatórios economiza horas de trabalho todo o mês.', stars: 5 },
  ];

  return (
    <>
      

      {/* ── Navbar ── */}
      <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
        <Link href="/" className="navbar-logo">
          <div className="navbar-logo-icon">
            <FileText style={{ width: 18, height: 18, color: 'white' }} />
          </div>
          Fatura<span className="ao">AO</span>
        </Link>

        <ul className="navbar-links">
          <li><a href="#funcionalidades">Funcionalidades</a></li>
          <li><a href="#compliance">Compliance AGT</a></li>
          <li><a href="#precos">Preços</a></li>
        </ul>

        <div className="navbar-actions">
          <Link href="/login" className="btn-ghost">Entrar</Link>
          <Link href="/register" className="btn-primary">
            Começar grátis <ArrowRight style={{ width: 16, height: 16 }} />
          </Link>
        </div>

        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          {menuOpen ? <X style={{ width: 24, height: 24 }} /> : <Menu style={{ width: 24, height: 24 }} />}
        </button>
      </nav>

      {/* ── Mobile Menu ── */}
      {menuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99, paddingTop: 68,
          background: 'rgba(10,22,40,0.98)', backdropFilter: 'blur(16px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '2rem',
        }}>
          <a href="#funcionalidades" style={{ color: 'white', fontSize: '1.5rem', fontWeight: 700, textDecoration: 'none' }} onClick={() => setMenuOpen(false)}>Funcionalidades</a>
          <a href="#compliance" style={{ color: 'white', fontSize: '1.5rem', fontWeight: 700, textDecoration: 'none' }} onClick={() => setMenuOpen(false)}>Compliance AGT</a>
          <a href="#precos" style={{ color: 'white', fontSize: '1.5rem', fontWeight: 700, textDecoration: 'none' }} onClick={() => setMenuOpen(false)}>Preços</a>
          <Link href="/login" className="btn-outline" onClick={() => setMenuOpen(false)}>Entrar</Link>
          <Link href="/register" className="btn-primary btn-large" onClick={() => setMenuOpen(false)}>Começar grátis</Link>
        </div>
      )}

      {/* ── Hero ── */}
      <section className="hero" id="inicio">
        <div className="hero-bg" />
        <div className="hero-grid" />
        <div className="hero-content">
          <div className="hero-badge">
            <div className="hero-badge-dot" />
            Certificado para compliance AGT Angola
          </div>

          <h1>
            Fatura com <span className="highlight">confiança</span><br />
            em Angola
          </h1>

          <p>
            O único SaaS de faturação construído especificamente para o mercado angolano.
            Hash SHA-256 encadeado, numeração sequencial AGT e PDFs profissionais em segundos.
          </p>

          <div className="hero-actions">
            <Link href="/register" className="btn-primary btn-large" id="cta-hero-register">
              Criar conta grátis <ArrowRight style={{ width: 18, height: 18 }} />
            </Link>
            <Link href="/login" className="btn-outline" id="cta-hero-login">
              Já tenho conta
            </Link>
          </div>

          <div className="hero-trust">
            {[
              'Sem cartão de crédito',
              '100% conforme AGT',
              'Dados em Angola',
            ].map((t) => (
              <div key={t} className="hero-trust-item">
                <Check style={{ width: 14, height: 14, color: '#22c55e' }} />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="stats-section">
        <div className="stats-grid">
          {stats.map((s) => (
            <div key={s.label} className="stat-item">
              <div className="stat-number">
                <AnimatedCounter target={s.value} suffix={s.suffix} prefix={s.prefix} />
              </div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="section" id="funcionalidades">
        <div className="section-inner">
          <div className="section-tag">
            <Zap style={{ width: 14, height: 14 }} /> Funcionalidades
          </div>
          <h2 className="section-title">Tudo o que precisa para<br />faturar em Angola</h2>
          <p className="section-subtitle">
            Construído especificamente para cumprir a legislação angolana, sem comprometer a simplicidade.
          </p>
          <div className="features-grid">
            {features.map((f, i) => (
              <FeatureCard key={i} {...f} delay={i * 80} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Compliance ── */}
      <section className="compliance-section" id="compliance">
        <div className="compliance-inner">
          <div>
            <div className="section-tag">
              <ShieldCheck style={{ width: 14, height: 14 }} /> Compliance AGT
            </div>
            <h2 className="section-title">Aprovado pela<br /><span style={{ color: 'var(--primary)' }}>Administração Geral Tributária</span></h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, margin: '1rem 0 1.5rem' }}>
              Cada fatura emitida cumpre integralmente os requisitos técnicos e legais da AGT Angola.
            </p>
            <ul className="compliance-list">
              {[
                'Numeração sequencial por série e ano (FT 2026/0001)',
                'Hash SHA-256 encadeado tipo blockchain',
                'Imutabilidade total das faturas emitidas',
                'Anulação com motivo obrigatório e registo',
                'NIF obrigatório em todas as transações',
                'IVA 14% com suporte a isenção justificada',
                'Exportação SAF-T Angola pronta a submeter',
                'Auditoria completa de todas as operações',
              ].map((item, i) => (
                <li key={i}>
                  <div className="compliance-check">
                    <Check style={{ width: 12, height: 12, color: 'var(--green)' }} />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="hash-demo">
            <div className="hash-demo-label">Exemplo de fatura emitida</div>
            <div className="hash-demo-number">FT 2026/0042</div>
            <div className="hash-demo-hash">hash: 7a9b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d</div>

            <div className="hash-chain">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Cadeia de hash (blockchain-style)</div>
              {[
                { num: 'FT 2026/040', hash: 'a1b2c3d4...' },
                { num: 'FT 2026/041', hash: 'e5f6a7b8...' },
                { num: 'FT 2026/042', hash: '7a9b3c4d...', current: true },
              ].map((h, i) => (
                <div key={i}>
                  {i > 0 && <div className="hash-arrow">↓</div>}
                  <div className="hash-link" style={h.current ? { borderColor: 'var(--primary)', background: 'rgba(19, 181, 234, 0.05)' } : {}}>
                    <span className="hash-link-num">{h.num}</span>
                    <span className="hash-link-val">{h.hash}</span>
                    {h.current && <span style={{ fontSize: '0.7rem', color: 'var(--green)', fontWeight: 700 }}>ATUAL</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="section" id="precos">
        <div className="section-inner">
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <div className="section-tag" style={{ justifyContent: 'center' }}>
              <TrendingUp style={{ width: 14, height: 14 }} /> Planos & Preços
            </div>
            <h2 className="section-title">Simples e transparente</h2>
            <p className="section-subtitle" style={{ margin: '0 auto' }}>
              Comece grátis, cresça quando precisar. Sem surpresas na fatura.
            </p>
          </div>
          <div className="pricing-grid">
            {plans.map((plan, i) => (
              <PricingCard key={i} {...plan} delay={i * 100} />
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
            Preços em Kwanzas (AOA). IVA de 14% não incluído. Pagamento por Multicaixa Express ou transferência bancária.
          </p>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="section" style={{ background: 'var(--bg-main)' }}>
        <div className="section-inner">
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <div className="section-tag" style={{ justifyContent: 'center' }}>
              <Star style={{ width: 14, height: 14 }} /> Depoimentos
            </div>
            <h2 className="section-title">Confiado por empresas angolanas</h2>
          </div>
          <div className="testimonials-grid">
            {testimonials.map((t, i) => {
              const { ref, inView } = useInView();
              return (
                <div
                  key={i}
                  ref={ref}
                  className="testimonial-card"
                  style={{
                    opacity: inView ? 1 : 0,
                    transform: inView ? 'translateY(0)' : 'translateY(24px)',
                    transition: `opacity 0.6s ease ${i * 120}ms, transform 0.6s ease ${i * 120}ms`,
                  }}
                >
                  <div className="testimonial-stars">
                    {Array.from({ length: t.stars }).map((_, si) => (
                      <Star key={si} style={{ width: 16, height: 16, fill: 'var(--gold)', color: 'var(--gold)' }} />
                    ))}
                  </div>
                  <p className="testimonial-text">"{t.text}"</p>
                  <div className="testimonial-author">
                    <div className="testimonial-avatar">{t.name[0]}</div>
                    <div>
                      <div className="testimonial-name">{t.name}</div>
                      <div className="testimonial-company">{t.company}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section className="cta-section">
        <div className="cta-inner">
          <div className="section-tag" style={{ justifyContent: 'center', color: 'rgba(255,255,255,0.9)' }}>
            <Award style={{ width: 14, height: 14 }} /> Comece hoje
          </div>
          <h2>Pronto para faturar<br />com <span style={{ color: 'var(--primary)' }}>confiança</span>?</h2>
          <p>Junte-se às empresas angolanas que já escolheram o FaturaAO.<br />Configura em 5 minutos, cumpre a AGT desde o primeiro documento.</p>
          <div className="cta-actions">
            <Link href="/register" className="btn-primary btn-large" id="cta-final-register">
              Criar conta grátis <ArrowRight style={{ width: 18, height: 18 }} />
            </Link>
          </div>
          <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
            Sem cartão de crédito · Cancela quando quiser · Suporte em português
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-inner">
          <div>
            <div className="footer-brand">
              <div className="navbar-logo-icon" style={{ width: 28, height: 28 }}>
                <FileText style={{ width: 14, height: 14, color: 'white' }} />
              </div>
              <span>Fatura<span style={{ color: '#f5a623' }}>AO</span></span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              O melhor SaaS de faturação de Angola.
            </p>
          </div>

          <ul className="footer-links">
            <li><a href="#funcionalidades">Funcionalidades</a></li>
            <li><a href="#precos">Preços</a></li>
            <li><Link href="/login">Entrar</Link></li>
            <li><Link href="/register">Registar</Link></li>
          </ul>

          <div className="footer-legal">
            <div className="footer-compliance-badge">
              <ShieldCheck style={{ width: 12, height: 12 }} />
              Compliance AGT Angola
            </div>
            <p style={{ marginTop: '0.5rem' }}>© {new Date().getFullYear()} FaturaAO · Todos os direitos reservados</p>
          </div>
        </div>
      </footer>
    </>
  );
}
