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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --navy: #0a1628;
          --navy-mid: #0f2040;
          --navy-light: #162d52;
          --blue: #1a7de8;
          --blue-light: #3b9eff;
          --blue-glow: rgba(26,125,232,0.35);
          --gold: #f5a623;
          --gold-light: #fbbf3e;
          --white: #ffffff;
          --white-80: rgba(255,255,255,0.8);
          --white-60: rgba(255,255,255,0.6);
          --white-20: rgba(255,255,255,0.12);
          --white-10: rgba(255,255,255,0.07);
          --green: #22c55e;
          --font: 'Inter', system-ui, sans-serif;
        }

        html { scroll-behavior: smooth; }

        body {
          font-family: var(--font);
          background: var(--navy);
          color: var(--white);
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }

        /* ── Navbar ── */
        .navbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 0 2rem;
          height: 68px;
          display: flex; align-items: center; justify-content: space-between;
          transition: all 0.3s ease;
        }
        .navbar--scrolled {
          background: rgba(10,22,40,0.92);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--white-20);
        }
        .navbar-logo {
          display: flex; align-items: center; gap: 10px;
          font-weight: 800; font-size: 1.25rem; color: var(--white);
          text-decoration: none; letter-spacing: -0.02em;
        }
        .navbar-logo-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, var(--blue), var(--blue-light));
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 20px var(--blue-glow);
        }
        .navbar-logo span.ao { color: var(--gold); }
        .navbar-links {
          display: flex; align-items: center; gap: 2rem;
          list-style: none;
        }
        .navbar-links a {
          color: var(--white-60); font-size: 0.9rem; font-weight: 500;
          text-decoration: none; transition: color 0.2s;
        }
        .navbar-links a:hover { color: var(--white); }
        .navbar-actions { display: flex; align-items: center; gap: 0.75rem; }
        .btn-ghost {
          color: var(--white-80); background: transparent; border: none;
          font-size: 0.9rem; font-weight: 500; cursor: pointer;
          padding: 0.5rem 1rem; border-radius: 8px;
          text-decoration: none; transition: all 0.2s;
        }
        .btn-ghost:hover { background: var(--white-10); color: var(--white); }
        .btn-primary {
          background: linear-gradient(135deg, var(--blue), var(--blue-light));
          color: var(--white); border: none; border-radius: 10px;
          font-size: 0.9rem; font-weight: 600; cursor: pointer;
          padding: 0.6rem 1.25rem; text-decoration: none;
          display: inline-flex; align-items: center; gap: 6px;
          transition: all 0.2s; box-shadow: 0 4px 16px var(--blue-glow);
        }
        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px var(--blue-glow);
        }
        .btn-large {
          padding: 0.85rem 2rem; font-size: 1rem; border-radius: 12px;
        }
        .btn-outline {
          background: transparent; color: var(--white);
          border: 1.5px solid var(--white-20); border-radius: 10px;
          font-size: 0.95rem; font-weight: 500; cursor: pointer;
          padding: 0.75rem 1.5rem; text-decoration: none;
          display: inline-flex; align-items: center; gap: 6px;
          transition: all 0.2s;
        }
        .btn-outline:hover { border-color: var(--blue); background: var(--blue-glow); }

        /* ── Hero ── */
        .hero {
          min-height: 100vh;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 120px 2rem 80px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .hero-bg {
          position: absolute; inset: 0; z-index: 0;
          background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(26,125,232,0.25) 0%, transparent 70%),
                      radial-gradient(ellipse 60% 40% at 80% 80%, rgba(245,166,35,0.08) 0%, transparent 60%),
                      var(--navy);
        }
        .hero-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 20%, black 20%, transparent 80%);
        }
        .hero-content { position: relative; z-index: 1; max-width: 840px; }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(26,125,232,0.15); border: 1px solid rgba(26,125,232,0.4);
          color: var(--blue-light); border-radius: 100px;
          padding: 6px 16px; font-size: 0.8rem; font-weight: 600;
          margin-bottom: 2rem; letter-spacing: 0.02em;
        }
        .hero-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--blue-light); animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        .hero h1 {
          font-size: clamp(2.5rem, 6vw, 4.5rem);
          font-weight: 900; line-height: 1.08;
          letter-spacing: -0.03em; margin-bottom: 1.5rem;
        }
        .hero h1 .highlight {
          background: linear-gradient(135deg, var(--blue-light), var(--gold));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero p {
          font-size: 1.2rem; color: var(--white-60); max-width: 600px;
          margin: 0 auto 2.5rem; line-height: 1.7;
        }
        .hero-actions { display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap; }
        .hero-trust {
          margin-top: 3rem; display: flex; align-items: center; justify-content: center;
          gap: 1.5rem; flex-wrap: wrap;
        }
        .hero-trust-item {
          display: flex; align-items: center; gap: 8px;
          color: var(--white-60); font-size: 0.85rem;
        }
        .hero-trust-item svg { color: var(--green); }

        /* ── Stats ── */
        .stats-section {
          padding: 5rem 2rem;
          background: var(--white-10);
          border-top: 1px solid var(--white-20);
          border-bottom: 1px solid var(--white-20);
        }
        .stats-grid {
          max-width: 1000px; margin: 0 auto;
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem;
          text-align: center;
        }
        .stat-item .stat-number {
          font-size: 3rem; font-weight: 900;
          background: linear-gradient(135deg, var(--blue-light), var(--gold));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text; line-height: 1; margin-bottom: 0.5rem;
        }
        .stat-item .stat-label { color: var(--white-60); font-size: 0.9rem; font-weight: 500; }

        /* ── Section ── */
        .section { padding: 6rem 2rem; }
        .section-inner { max-width: 1200px; margin: 0 auto; }
        .section-tag {
          display: inline-flex; align-items: center; gap: 6px;
          color: var(--blue-light); font-size: 0.8rem; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          margin-bottom: 1rem;
        }
        .section-title {
          font-size: clamp(1.8rem, 4vw, 2.8rem); font-weight: 800;
          line-height: 1.15; letter-spacing: -0.02em; margin-bottom: 1rem;
        }
        .section-subtitle { color: var(--white-60); font-size: 1.1rem; line-height: 1.6; max-width: 560px; }

        /* ── Features ── */
        .features-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem; margin-top: 4rem;
        }
        .feature-card {
          background: var(--white-10); border: 1px solid var(--white-20);
          border-radius: 16px; padding: 2rem;
          transition: all 0.3s ease;
        }
        .feature-card:hover {
          background: rgba(26,125,232,0.1); border-color: rgba(26,125,232,0.4);
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .feature-icon-wrap {
          width: 48px; height: 48px; border-radius: 12px;
          background: linear-gradient(135deg, rgba(26,125,232,0.3), rgba(59,158,255,0.2));
          border: 1px solid rgba(26,125,232,0.4);
          display: flex; align-items: center; justify-content: center;
          color: var(--blue-light); margin-bottom: 1.25rem;
        }
        .feature-card h3 { font-size: 1.05rem; font-weight: 700; margin-bottom: 0.6rem; }
        .feature-card p { color: var(--white-60); font-size: 0.9rem; line-height: 1.6; }

        /* ── Compliance visual ── */
        .compliance-section { padding: 6rem 2rem; }
        .compliance-inner {
          max-width: 1200px; margin: 0 auto;
          display: grid; grid-template-columns: 1fr 1fr; gap: 5rem; align-items: center;
        }
        .compliance-list { list-style: none; margin-top: 2rem; }
        .compliance-list li {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 0.75rem 0; border-bottom: 1px solid var(--white-20);
          color: var(--white-80); font-size: 0.95rem;
        }
        .compliance-check {
          width: 22px; height: 22px; border-radius: 50%;
          background: linear-gradient(135deg, var(--green), #16a34a);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
        }
        .hash-demo {
          background: rgba(10,22,40,0.8); border: 1px solid var(--white-20);
          border-radius: 20px; padding: 2.5rem;
          position: relative; overflow: hidden;
        }
        .hash-demo::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse at 70% 0%, rgba(26,125,232,0.15) 0%, transparent 60%);
        }
        .hash-demo-label { color: var(--white-60); font-size: 0.75rem; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 0.5rem; }
        .hash-demo-number { font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; color: var(--blue-light); margin-bottom: 0.5rem; }
        .hash-demo-hash { font-family: 'Courier New', monospace; font-size: 0.7rem; color: var(--white-40, rgba(255,255,255,0.4)); word-break: break-all; background: var(--white-10); padding: 0.75rem; border-radius: 8px; }
        .hash-chain {
          margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;
        }
        .hash-link {
          background: var(--white-10); border: 1px solid var(--white-20);
          border-radius: 10px; padding: 1rem;
          display: flex; justify-content: space-between; align-items: center;
        }
        .hash-link-num { font-weight: 700; font-size: 0.85rem; color: var(--blue-light); }
        .hash-link-val { font-family: monospace; font-size: 0.7rem; color: var(--white-60); }
        .hash-arrow { color: var(--white-20); font-size: 1.2rem; text-align: center; }

        /* ── Pricing ── */
        .pricing-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;
          margin-top: 4rem; align-items: start;
        }
        .pricing-card {
          background: var(--white-10); border: 1px solid var(--white-20);
          border-radius: 20px; padding: 2rem; position: relative;
          transition: all 0.3s ease;
        }
        .pricing-card--highlight {
          background: linear-gradient(135deg, rgba(26,125,232,0.2), rgba(59,158,255,0.1));
          border-color: rgba(26,125,232,0.5);
          box-shadow: 0 0 60px rgba(26,125,232,0.2);
          transform: scale(1.02);
        }
        .pricing-badge {
          position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
          background: linear-gradient(135deg, var(--blue), var(--blue-light));
          color: white; font-size: 0.75rem; font-weight: 700;
          padding: 4px 16px; border-radius: 100px; white-space: nowrap;
        }
        .pricing-name { font-size: 0.85rem; font-weight: 700; color: var(--white-60); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1rem; }
        .pricing-price { margin-bottom: 0.5rem; }
        .pricing-amount { font-size: 2.2rem; font-weight: 900; letter-spacing: -0.03em; }
        .pricing-period { color: var(--white-60); font-size: 0.9rem; margin-left: 4px; }
        .pricing-toggle { background: none; border: none; color: var(--blue-light); font-size: 0.75rem; cursor: pointer; padding: 4px 0; margin-bottom: 0.5rem; display: block; }
        .pricing-desc { color: var(--white-60); font-size: 0.85rem; margin-bottom: 1.5rem; line-height: 1.5; }
        .pricing-features { list-style: none; margin-bottom: 1.75rem; }
        .pricing-features li { display: flex; align-items: flex-start; gap: 10px; padding: 0.45rem 0; font-size: 0.9rem; color: var(--white-80); }
        .pricing-cta {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 0.8rem; border-radius: 10px;
          border: 1.5px solid var(--white-20); background: var(--white-10);
          color: var(--white); font-weight: 600; font-size: 0.9rem;
          text-decoration: none; transition: all 0.2s;
        }
        .pricing-cta:hover { border-color: var(--blue); background: var(--blue-glow); }
        .pricing-cta--highlight {
          background: linear-gradient(135deg, var(--blue), var(--blue-light));
          border-color: transparent; box-shadow: 0 8px 24px var(--blue-glow);
        }
        .pricing-cta--highlight:hover { transform: translateY(-2px); box-shadow: 0 12px 32px var(--blue-glow); }

        /* ── Testimonials ── */
        .testimonials-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;
          margin-top: 4rem;
        }
        .testimonial-card {
          background: var(--white-10); border: 1px solid var(--white-20);
          border-radius: 16px; padding: 1.75rem;
        }
        .testimonial-stars { color: var(--gold); display: flex; gap: 4px; margin-bottom: 1rem; }
        .testimonial-text { color: var(--white-80); font-size: 0.95rem; line-height: 1.65; margin-bottom: 1.25rem; }
        .testimonial-author { display: flex; align-items: center; gap: 12px; }
        .testimonial-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: linear-gradient(135deg, var(--blue), var(--gold));
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 0.9rem;
        }
        .testimonial-name { font-weight: 700; font-size: 0.9rem; }
        .testimonial-company { color: var(--white-60); font-size: 0.8rem; }

        /* ── CTA Final ── */
        .cta-section {
          padding: 8rem 2rem;
          text-align: center;
          position: relative; overflow: hidden;
        }
        .cta-section::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse 70% 80% at 50% 50%, rgba(26,125,232,0.2) 0%, transparent 70%);
        }
        .cta-inner { position: relative; z-index: 1; max-width: 700px; margin: 0 auto; }
        .cta-section h2 {
          font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 900;
          line-height: 1.1; letter-spacing: -0.03em; margin-bottom: 1.25rem;
        }
        .cta-section p { color: var(--white-60); font-size: 1.1rem; margin-bottom: 2.5rem; }
        .cta-actions { display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap; }

        /* ── Footer ── */
        .footer {
          border-top: 1px solid var(--white-20);
          padding: 3rem 2rem;
          background: var(--navy-mid);
        }
        .footer-inner { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem; }
        .footer-brand { display: flex; align-items: center; gap: 8px; font-weight: 700; }
        .footer-links { display: flex; gap: 2rem; list-style: none; flex-wrap: wrap; }
        .footer-links a { color: var(--white-60); font-size: 0.85rem; text-decoration: none; transition: color 0.2s; }
        .footer-links a:hover { color: var(--white); }
        .footer-legal { color: var(--white-60); font-size: 0.8rem; text-align: right; }
        .footer-compliance-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3);
          color: var(--green); border-radius: 100px;
          padding: 4px 12px; font-size: 0.75rem; font-weight: 600;
        }

        /* ── Hamburger ── */
        .hamburger { display: none; background: none; border: none; cursor: pointer; color: var(--white); }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .compliance-inner { grid-template-columns: 1fr; gap: 3rem; }
          .pricing-grid { grid-template-columns: 1fr; max-width: 420px; margin-left: auto; margin-right: auto; }
          .pricing-card--highlight { transform: none; }
        }
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .features-grid { grid-template-columns: 1fr; }
          .testimonials-grid { grid-template-columns: 1fr; }
          .navbar-links, .navbar-actions { display: none; }
          .hamburger { display: flex; }
          .footer-inner { flex-direction: column; text-align: center; }
          .footer-legal { text-align: center; }
        }
      `}</style>

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
      <section className="compliance-section" id="compliance" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <div className="compliance-inner">
          <div>
            <div className="section-tag">
              <ShieldCheck style={{ width: 14, height: 14 }} /> Compliance AGT
            </div>
            <h2 className="section-title">Aprovado pela<br /><span style={{ color: '#3b9eff' }}>Administração Geral Tributária</span></h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, margin: '1rem 0 1.5rem' }}>
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
                    <Check style={{ width: 12, height: 12, color: 'white' }} />
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
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cadeia de hash (blockchain-style)</div>
              {[
                { num: 'FT 2026/040', hash: 'a1b2c3d4...' },
                { num: 'FT 2026/041', hash: 'e5f6a7b8...' },
                { num: 'FT 2026/042', hash: '7a9b3c4d...', current: true },
              ].map((h, i) => (
                <div key={i}>
                  {i > 0 && <div className="hash-arrow">↓</div>}
                  <div className="hash-link" style={h.current ? { borderColor: 'rgba(26,125,232,0.5)', background: 'rgba(26,125,232,0.1)' } : {}}>
                    <span className="hash-link-num">{h.num}</span>
                    <span className="hash-link-val">{h.hash}</span>
                    {h.current && <span style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 700 }}>ATUAL</span>}
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
          <p style={{ textAlign: 'center', marginTop: '2rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
            Preços em Kwanzas (AOA). IVA de 14% não incluído. Pagamento por Multicaixa Express ou transferência bancária.
          </p>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="section" style={{ background: 'rgba(255,255,255,0.03)' }}>
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
                      <Star key={si} style={{ width: 16, height: 16, fill: '#f5a623' }} />
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
          <div className="section-tag" style={{ justifyContent: 'center' }}>
            <Award style={{ width: 14, height: 14 }} /> Comece hoje
          </div>
          <h2>Pronto para faturar<br />com <span style={{ color: '#3b9eff' }}>confiança</span>?</h2>
          <p>Junte-se às empresas angolanas que já escolheram o FaturaAO.<br />Configura em 5 minutos, cumpre a AGT desde o primeiro documento.</p>
          <div className="cta-actions">
            <Link href="/register" className="btn-primary btn-large" id="cta-final-register">
              Criar conta grátis <ArrowRight style={{ width: 18, height: 18 }} />
            </Link>
          </div>
          <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>
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
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
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
