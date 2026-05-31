const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'app', 'page.tsx');
let content = fs.readFileSync(file, 'utf8');

// Replace the entire <style> block
const styleRegex = /<style>\{`([\s\S]*?)`\}<\/style>/;
const newStyle = `<style>{\`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg-main: #f4f5f8;
          --bg-card: #ffffff;
          --header-bg: #0b4a6f;
          --header-hover: #093c5a;
          --primary: #13b5ea;
          --primary-hover: #0fa2d3;
          --text-dark: #0f172a;
          --text-main: #334155;
          --text-muted: #64748b;
          --border: #e2e8f0;
          --green: #107C10;
          --gold: #f5a623;
          --font: 'Inter', system-ui, sans-serif;
        }

        html { scroll-behavior: smooth; }

        body {
          font-family: var(--font);
          background: var(--bg-main);
          color: var(--text-main);
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }

        /* ── Navbar ── */
        .navbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 0 2rem; height: 68px;
          display: flex; align-items: center; justify-content: space-between;
          background: var(--header-bg); border-bottom: 1px solid rgba(255,255,255,0.1);
          transition: all 0.3s ease; color: white;
        }
        .navbar--scrolled {
          background: rgba(11, 74, 111, 0.98); backdrop-filter: blur(8px);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .navbar-logo {
          display: flex; align-items: center; gap: 10px;
          font-weight: 700; font-size: 1.25rem; color: white;
          text-decoration: none; letter-spacing: -0.02em;
        }
        .navbar-logo-icon {
          width: 32px; height: 32px; border-radius: 8px;
          background: var(--primary); color: white;
          display: flex; align-items: center; justify-content: center;
        }
        .navbar-logo span.ao { color: var(--primary); }
        .navbar-links {
          display: flex; align-items: center; gap: 2rem; list-style: none;
        }
        .navbar-links a {
          color: rgba(255,255,255,0.8); font-size: 0.9rem; font-weight: 500;
          text-decoration: none; transition: color 0.2s;
        }
        .navbar-links a:hover { color: white; }
        .navbar-actions { display: flex; align-items: center; gap: 0.75rem; }
        .btn-ghost {
          color: rgba(255,255,255,0.9); background: transparent; border: none;
          font-size: 0.9rem; font-weight: 500; cursor: pointer;
          padding: 0.5rem 1rem; border-radius: 6px; text-decoration: none; transition: all 0.2s;
        }
        .btn-ghost:hover { background: var(--header-hover); color: white; }
        .btn-primary {
          background: var(--primary); color: white; border: none; border-radius: 6px;
          font-size: 0.9rem; font-weight: 600; cursor: pointer;
          padding: 0.6rem 1.25rem; text-decoration: none;
          display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;
        }
        .btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(19, 181, 234, 0.3); }
        .btn-large { padding: 0.85rem 2rem; font-size: 1rem; border-radius: 8px; }
        .btn-outline {
          background: transparent; color: var(--primary);
          border: 1.5px solid var(--primary); border-radius: 6px;
          font-size: 0.95rem; font-weight: 500; cursor: pointer;
          padding: 0.75rem 1.5rem; text-decoration: none;
          display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;
        }
        .btn-outline:hover { background: rgba(19, 181, 234, 0.05); }

        /* ── Hero ── */
        .hero {
          min-height: 90vh;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 140px 2rem 80px; text-align: center;
          position: relative; overflow: hidden; background: var(--bg-main);
        }
        .hero-bg {
          position: absolute; inset: 0; z-index: 0;
          background: radial-gradient(circle at 50% 0%, white 0%, var(--bg-main) 70%);
        }
        .hero-grid { display: none; }
        .hero-content { position: relative; z-index: 1; max-width: 840px; }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: white; border: 1px solid var(--border);
          color: var(--text-main); border-radius: 100px;
          padding: 6px 16px; font-size: 0.8rem; font-weight: 600;
          margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .hero-badge-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--green); animation: pulse 2s infinite;
        }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.1); } }
        .hero h1 {
          font-size: clamp(2.5rem, 6vw, 4.2rem); font-weight: 800; line-height: 1.1;
          letter-spacing: -0.03em; margin-bottom: 1.5rem; color: var(--text-dark);
        }
        .hero h1 .highlight { color: var(--primary); }
        .hero p {
          font-size: 1.2rem; color: var(--text-muted); max-width: 600px;
          margin: 0 auto 2.5rem; line-height: 1.7;
        }
        .hero-actions { display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap; }
        .hero-trust { margin-top: 3rem; display: flex; align-items: center; justify-content: center; gap: 1.5rem; flex-wrap: wrap; }
        .hero-trust-item { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 0.85rem; font-weight: 500; }
        .hero-trust-item svg { color: var(--green); }

        /* ── Stats ── */
        .stats-section {
          padding: 4rem 2rem; background: white;
          border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
        }
        .stats-grid { max-width: 1000px; margin: 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem; text-align: center; }
        .stat-item .stat-number {
          font-size: 2.5rem; font-weight: 800; color: var(--primary);
          line-height: 1; margin-bottom: 0.5rem;
        }
        .stat-item .stat-label { color: var(--text-muted); font-size: 0.9rem; font-weight: 500; }

        /* ── Section ── */
        .section { padding: 6rem 2rem; }
        .section-inner { max-width: 1200px; margin: 0 auto; }
        .section-tag {
          display: inline-flex; align-items: center; gap: 6px;
          color: var(--primary); font-size: 0.85rem; font-weight: 700;
          text-transform: uppercase; margin-bottom: 1rem; letter-spacing: 0.05em;
        }
        .section-title {
          font-size: clamp(1.8rem, 4vw, 2.5rem); font-weight: 800;
          line-height: 1.2; letter-spacing: -0.02em; margin-bottom: 1rem; color: var(--text-dark);
        }
        .section-subtitle { color: var(--text-muted); font-size: 1.1rem; line-height: 1.6; max-width: 600px; }

        /* ── Features ── */
        .features-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; margin-top: 3rem; }
        .feature-card {
          background: white; border: 1px solid var(--border);
          border-radius: 12px; padding: 2rem;
          transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .feature-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.06); border-color: rgba(19,181,234,0.3); }
        .feature-icon-wrap {
          width: 48px; height: 48px; border-radius: 10px;
          background: rgba(19, 181, 234, 0.1); border: 1px solid rgba(19, 181, 234, 0.2);
          display: flex; align-items: center; justify-content: center;
          color: var(--primary); margin-bottom: 1.25rem;
        }
        .feature-card h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.6rem; color: var(--text-dark); }
        .feature-card p { color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; }

        /* ── Compliance visual ── */
        .compliance-section { padding: 6rem 2rem; background: white; }
        .compliance-inner { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; }
        .compliance-list { list-style: none; margin-top: 2rem; }
        .compliance-list li {
          display: flex; align-items: flex-start; gap: 12px; padding: 0.75rem 0;
          border-bottom: 1px solid var(--border); color: var(--text-main); font-size: 0.95rem; font-weight: 500;
        }
        .compliance-check {
          width: 20px; height: 20px; border-radius: 50%; background: rgba(16, 124, 16, 0.1);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;
        }
        .hash-demo {
          background: #f8fafc; border: 1px solid var(--border);
          border-radius: 12px; padding: 2.5rem; position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.05);
        }
        .hash-demo-label { color: var(--text-muted); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; margin-bottom: 0.5rem; }
        .hash-demo-number { font-size: 2rem; font-weight: 800; color: var(--text-dark); margin-bottom: 0.5rem; font-family: monospace; }
        .hash-demo-hash { font-family: monospace; font-size: 0.75rem; color: var(--text-muted); word-break: break-all; background: white; padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border); }
        .hash-chain { margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .hash-link {
          background: white; border: 1px solid var(--border); border-radius: 8px; padding: 1rem;
          display: flex; justify-content: space-between; align-items: center;
        }
        .hash-link-num { font-weight: 600; font-size: 0.85rem; color: var(--text-dark); font-family: monospace; }
        .hash-link-val { font-family: monospace; font-size: 0.75rem; color: var(--text-muted); }
        .hash-arrow { color: var(--text-muted); font-size: 1rem; text-align: center; }

        /* ── Pricing ── */
        .pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-top: 3rem; align-items: start; }
        .pricing-card { background: white; border: 1px solid var(--border); border-radius: 16px; padding: 2.5rem 2rem; position: relative; transition: all 0.2s ease; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .pricing-card--highlight { border: 2px solid var(--primary); transform: scale(1.02); box-shadow: 0 12px 24px rgba(19, 181, 234, 0.15); }
        .pricing-badge {
          position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
          background: var(--primary); color: white; font-size: 0.75rem; font-weight: 700;
          padding: 4px 16px; border-radius: 100px; white-space: nowrap; text-transform: uppercase;
        }
        .pricing-name { font-size: 1.1rem; font-weight: 700; color: var(--text-dark); margin-bottom: 1rem; }
        .pricing-price { margin-bottom: 0.5rem; color: var(--text-dark); }
        .pricing-amount { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.02em; }
        .pricing-period { color: var(--text-muted); font-size: 0.9rem; margin-left: 4px; font-weight: 500; }
        .pricing-toggle { background: none; border: none; color: var(--primary); font-size: 0.85rem; font-weight: 600; cursor: pointer; padding: 4px 0; margin-bottom: 1rem; display: block; }
        .pricing-desc { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem; line-height: 1.5; }
        .pricing-features { list-style: none; margin-bottom: 2rem; }
        .pricing-features li { display: flex; align-items: flex-start; gap: 10px; padding: 0.5rem 0; font-size: 0.9rem; color: var(--text-main); font-weight: 500; }
        .pricing-cta {
          display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 0.8rem; border-radius: 8px;
          border: 1px solid var(--primary); background: transparent; color: var(--primary); font-weight: 600; font-size: 0.95rem;
          text-decoration: none; transition: all 0.2s;
        }
        .pricing-cta:hover { background: rgba(19, 181, 234, 0.05); }
        .pricing-cta--highlight { background: var(--primary); color: white; border-color: var(--primary); }
        .pricing-cta--highlight:hover { background: var(--primary-hover); color: white; }

        /* ── Testimonials ── */
        .testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-top: 3rem; }
        .testimonial-card { background: white; border: 1px solid var(--border); border-radius: 12px; padding: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .testimonial-stars { color: var(--gold); display: flex; gap: 4px; margin-bottom: 1rem; }
        .testimonial-text { color: var(--text-main); font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; font-style: italic; }
        .testimonial-author { display: flex; align-items: center; gap: 12px; }
        .testimonial-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: var(--bg-main); color: var(--primary); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem;
        }
        .testimonial-name { font-weight: 700; font-size: 0.9rem; color: var(--text-dark); }
        .testimonial-company { color: var(--text-muted); font-size: 0.8rem; }

        /* ── CTA Final ── */
        .cta-section { padding: 6rem 2rem; text-align: center; background: var(--header-bg); color: white; }
        .cta-inner { max-width: 700px; margin: 0 auto; }
        .cta-section h2 { font-size: clamp(2rem, 5vw, 3rem); font-weight: 800; line-height: 1.1; margin-bottom: 1.25rem; }
        .cta-section p { color: rgba(255,255,255,0.8); font-size: 1.1rem; margin-bottom: 2.5rem; line-height: 1.6; }
        .cta-actions { display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap; }
        .cta-section .btn-outline { border-color: rgba(255,255,255,0.3); color: white; }
        .cta-section .btn-outline:hover { background: rgba(255,255,255,0.1); border-color: white; }

        /* ── Footer ── */
        .footer { border-top: 1px solid var(--border); padding: 3rem 2rem; background: white; }
        .footer-inner { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem; }
        .footer-brand { display: flex; align-items: center; gap: 8px; font-weight: 800; color: var(--header-bg); font-size: 1.2rem; }
        .footer-links { display: flex; gap: 2rem; list-style: none; flex-wrap: wrap; }
        .footer-links a { color: var(--text-muted); font-size: 0.9rem; font-weight: 500; text-decoration: none; transition: color 0.2s; }
        .footer-links a:hover { color: var(--primary); }
        .footer-legal { color: var(--text-muted); font-size: 0.8rem; text-align: right; }
        .footer-compliance-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(16, 124, 16, 0.1); color: var(--green);
          border-radius: 100px; padding: 4px 12px; font-size: 0.75rem; font-weight: 600;
        }

        /* ── Hamburger ── */
        .hamburger { display: none; background: none; border: none; cursor: pointer; color: white; }

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
      \`}</style>`;

content = content.replace(styleRegex, newStyle);

// 2. Inline styles replacements

// 2.1 Compliance section background
content = content.replace(/<section className="compliance-section" id="compliance" style={{ background: 'rgba\(255,255,255,0\.03\)' }}>/g, '<section className="compliance-section" id="compliance">');

// 2.2 <span style={{ color: '#3b9eff' }}>Administração Geral Tributária</span>
content = content.replace(/<span style={{ color: '#3b9eff' }}>/g, '<span style={{ color: \'var(--primary)\' }}>');

// 2.3 <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, margin: '1rem 0 1.5rem' }}>
content = content.replace(/<p style={{ color: 'rgba\(255,255,255,0\.6\)', lineHeight: 1\.7, margin: '1rem 0 1\.5rem' }}>/g, '<p style={{ color: \'var(--text-muted)\', lineHeight: 1.7, margin: \'1rem 0 1.5rem\' }}>');

// 2.4 <Check style={{ width: 12, height: 12, color: 'white' }} />
content = content.replace(/<Check style={{ width: 12, height: 12, color: 'white' }} \/>/g, '<Check style={{ width: 12, height: 12, color: \'var(--green)\' }} />');

// 2.5 Hash chain label
content = content.replace(/<div style={{ fontSize: '0\.75rem', color: 'rgba\(255,255,255,0\.4\)', textTransform: 'uppercase', letterSpacing: '0\.05em' }}>Cadeia de hash \(blockchain-style\)<\/div>/g, '<div style={{ fontSize: \'0.75rem\', color: \'var(--text-muted)\', textTransform: \'uppercase\', letterSpacing: \'0.05em\', fontWeight: 600 }}>Cadeia de hash (blockchain-style)</div>');

// 2.6 Hash link style
content = content.replace(/<div className="hash-link" style={h\.current \? { borderColor: 'rgba\(26,125,232,0\.5\)', background: 'rgba\(26,125,232,0\.1\)' } : {}}>/g, '<div className="hash-link" style={h.current ? { borderColor: \'var(--primary)\', background: \'rgba(19, 181, 234, 0.05)\' } : {}}>');

// 2.7 ATUAL color
content = content.replace(/<span style={{ fontSize: '0\.7rem', color: '#22c55e', fontWeight: 700 }}>ATUAL<\/span>/g, '<span style={{ fontSize: \'0.7rem\', color: \'var(--green)\', fontWeight: 700 }}>ATUAL</span>');

// 2.8 Pricing desc
content = content.replace(/<p style={{ textAlign: 'center', marginTop: '2rem', color: 'rgba\(255,255,255,0\.4\)', fontSize: '0\.85rem' }}>/g, '<p style={{ textAlign: \'center\', marginTop: \'2rem\', color: \'var(--text-muted)\', fontSize: \'0.85rem\', fontWeight: 500 }}>');

// 2.9 Testimonials background
content = content.replace(/<section className="section" style={{ background: 'rgba\(255,255,255,0\.03\)' }}>/g, '<section className="section" style={{ background: \'var(--bg-main)\' }}>');

// 2.10 Testimonials stars
content = content.replace(/<Star key={si} style={{ width: 16, height: 16, fill: '#f5a623' }} \/>/g, '<Star key={si} style={{ width: 16, height: 16, fill: \'var(--gold)\', color: \'var(--gold)\' }} />');

// 2.11 CTA Final award tag
content = content.replace(/<div className="section-tag" style={{ justifyContent: 'center' }}>\s*<Award style={{ width: 14, height: 14 }} \/> Comece hoje\s*<\/div>/g, '<div className="section-tag" style={{ justifyContent: \'center\', color: \'rgba(255,255,255,0.9)\' }}>\n            <Award style={{ width: 14, height: 14 }} /> Comece hoje\n          </div>');

// 2.12 CTA Final title
content = content.replace(/<h2>Pronto para faturar<br \/>com <span style={{ color: '#3b9eff' }}>confiança<\/span>\?<\/h2>/g, '<h2>Pronto para faturar<br />com <span style={{ color: \'var(--gold)\' }}>confiança</span>?</h2>');

// 2.13 CTA Final bottom text
content = content.replace(/<p style={{ marginTop: '1\.5rem', fontSize: '0\.85rem', color: 'rgba\(255,255,255,0\.4\)' }}>/g, '<p style={{ marginTop: \'1.5rem\', fontSize: \'0.85rem\', color: \'rgba(255,255,255,0.6)\' }}>');

// 2.14 Footer logo text
content = content.replace(/<FileText style={{ width: 14, height: 14, color: 'white' }} \/>/g, '<FileText style={{ width: 14, height: 14, color: \'white\' }} />');

// 2.15 Footer text color
content = content.replace(/<p style={{ color: 'rgba\(255,255,255,0\.4\)', fontSize: '0\.8rem', marginTop: '0\.5rem' }}>/g, '<p style={{ color: \'var(--text-muted)\', fontSize: \'0.8rem\', marginTop: \'0.5rem\' }}>');

fs.writeFileSync(file, content, 'utf8');
console.log('Done redesigning page.tsx');
