import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './artisys-landing.css';

// Preserved from the existing site; replace after confirming the business contact.
const whatsappUrl = `https://wa.me/5516999999999?text=${encodeURIComponent('Olá, vim pelo site da ArtiSys e quero conversar sobre um projeto para minha empresa.')}`;
const instagramUrl = 'https://instagram.com/artisys';
const modes = ['Sistemas', 'Sites', 'Automações'];

function Icon({ name = 'arrow', size = 20, ...props }) {
  const paths = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    diagonal: <><path d="M6 18 18 6M6 6h12v12" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
    flow: <><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h6a3 3 0 0 1 3 3v6M3 18h7m-3-3 3 3-3 3"/></>,
    chart: <><path d="M4 4v16h16M8 15v-4m5 4V7m5 8v-6"/></>,
    login: <><path d="M10 5V3h10v18H10v-2M3 12h11m-4-4 4 4-4 4"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

function Reveal({ children, className = '', as: Tag = 'div' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!window.IntersectionObserver || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < innerHeight) return;
    el.classList.add('reveal-pending');
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { el.classList.remove('reveal-pending'); el.classList.add('reveal-enter'); observer.disconnect(); }
    }, { threshold: 0.08 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <Tag ref={ref} className={className}>{children}</Tag>;
}

function ProductPreview() {
  const [mode, setMode] = useState(0);
  function moveTab(event) {
    let next;
    if (event.key === 'ArrowRight') next = (mode + 1) % modes.length;
    if (event.key === 'ArrowLeft') next = (mode + modes.length - 1) % modes.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = modes.length - 1;
    if (next !== undefined) { event.preventDefault(); setMode(next); document.getElementById(`preview-tab-${next}`).focus(); }
  }
  return <div className="preview-wrap">
    <div className="preview-caption"><span className="small-caps">Da ideia à interface</span><span className="demo-label">Prévia ilustrativa</span></div>
    <div className="preview-tabs" role="tablist" aria-label="Explore nossas soluções" onKeyDown={moveTab}>
      {modes.map((label, i) => <button key={label} role="tab" id={`preview-tab-${i}`} aria-selected={mode === i} aria-controls="preview-panel" tabIndex={mode === i ? 0 : -1} onClick={() => setMode(i)}><Icon name={['grid','globe','flow'][i]} size={15}/>{label}</button>)}
    </div>
    <div className="product-window" id="preview-panel" role="tabpanel" aria-labelledby={`preview-tab-${mode}`} tabIndex={0}>
      <div className="window-bar"><span className="window-dots" aria-hidden="true"><i/><i/><i/></span><span>seu negócio / {modes[mode].toLowerCase()}</span><Icon name="spark" size={13}/></div>
      <div className="preview-content" key={mode}>
        {mode === 0 && <div className="dashboard">
          <div className="dashboard-top"><div><span className="micro">VISÃO GERAL</span><h3>Clareza para decidir.</h3></div><span className="avatar">AS</span></div>
          <div className="dashboard-metrics"><div><span>Seu financeiro</span><strong>Em perspectiva</strong></div><div><span>Sua operação</span><strong>Em um só lugar</strong></div></div>
          <div className="chart-header"><span>Movimento do caixa</span><span><i/> Ilustrativo</span></div>
          <svg className="cash-chart" viewBox="0 0 440 140" role="img" aria-label="Exemplo visual de gráfico de caixa, sem dados reais"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity=".24"/><stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/></linearGradient></defs><path className="chart-grid" d="M0 30H440M0 75H440M0 120H440"/><path d="M0 116C30 116 30 85 60 89S100 110 130 72S165 94 200 57S250 90 285 51S320 75 355 38S401 47 440 13V140H0Z" fill="url(#chart-fill)"/><path className="chart-line" d="M0 116C30 116 30 85 60 89S100 110 130 72S165 94 200 57S250 90 285 51S320 75 355 38S401 47 440 13"/><circle cx="436" cy="16" r="4" fill="#3b82f6"/></svg>
          <div className="chart-footer"><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span></div>
          <div className="preview-task"><span className="check-icon"><Icon name="check" size={13}/></span><span>Documentos e rotinas conectados</span><Icon name="arrow" size={15}/></div>
        </div>}
        {mode === 1 && <div className="site-preview"><div className="mini-nav"><strong>sua marca.</strong><span>Sobre &nbsp; Serviços</span></div><span className="site-tag">PRESENÇA DIGITAL</span><h3>Uma boa primeira<br/>impressão.<br/><em>Em cada detalhe.</em></h3><p>Seu negócio apresentado com clareza, personalidade e propósito.</p><span className="mini-cta">Vamos conversar <Icon name="arrow" size={14}/></span><div className="mini-site-footer"><span>Feito para o seu negócio</span><Icon name="globe" size={20}/></div></div>}
        {mode === 2 && <div className="automation-preview"><span className="micro">MENOS TRABALHO REPETITIVO</span><h3>O próximo passo,<br/>já encaminhado.</h3><div className="flow-list">{[['globe','01','Contato recebido','Um novo interesse pelo seu negócio.'],['grid','02','Oportunidade organizada','Informações no lugar certo.'],['check','03','Atendimento preparado','Sua equipe pronta para continuar.']].map(([icon,n,title,text])=><div className="flow-item" key={n}><span className="flow-icon"><Icon name={icon} size={18}/></span><div><strong>{title}</strong><small>{text}</small></div><span className="flow-number">{n}</span></div>)}</div><p className="flow-note">Você define as regras. O fluxo cuida da rotina.</p></div>}
      </div>
    </div>
    <div className="preview-bottom"><span><i/> Pensado para quem usa</span><span>Desktop & mobile <Icon name="diagonal" size={13}/></span></div>
  </div>;
}

const services = [
  { n:'01', icon:'globe', title:'Uma presença que representa você.', subtitle:'Sites profissionais', text:'Seu negócio com uma apresentação à altura. Páginas rápidas, claras e feitas para transformar interesse em conversa.', tags:['Institucional','Landing pages','Mobile-first'], link:'Quero um site' },
  { n:'02', icon:'grid', title:'Seu jeito de trabalhar. Organizado.', subtitle:'Sistemas sob medida', text:'Obras, vendas, estoque ou atendimentos. Ferramentas que conectam informações e fazem sentido na sua rotina.', tags:['Gestão','Painéis','Aplicativos'], link:'Quero um sistema' },
  { n:'03', icon:'flow', title:'Menos repetição. Mais tempo.', subtitle:'Automações comerciais', text:'Conecte etapas, organize oportunidades e prepare atendimentos. Sua equipe concentra energia no que exige atenção.', tags:['Processos','Integrações','Atendimento'], link:'Quero automatizar' },
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    function close(event) { if (event.key === 'Escape') { setMenuOpen(false); menuRef.current?.focus(); } }
    if (menuOpen) window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);
  return <>
    <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <header className="header" id="topo"><nav className="nav container" aria-label="Navegação principal">
      <a className="brand" href="#topo" aria-label="ArtiSys, início"><img src="/artisys-logo.svg" alt="ArtiSys" width="560" height="192"/></a>
      <a className="nav-login" href="./sistema.html#portal" aria-label="Acessar sistema" title="Acessar sistema"><Icon name="login" size={21}/></a>
      <button className="menu-toggle" ref={menuRef} onClick={()=>setMenuOpen(!menuOpen)} aria-label={menuOpen?'Fechar menu':'Abrir menu'} aria-expanded={menuOpen} aria-controls="nav-links"><Icon name={menuOpen?'close':'menu'}/></button>
      <div className={`nav-links ${menuOpen?'is-open':''}`} id="nav-links">
        <a href="#servicos" onClick={()=>setMenuOpen(false)}>Soluções</a><a href="#prova" onClick={()=>setMenuOpen(false)}>Depoimentos</a><a href="#processo" onClick={()=>setMenuOpen(false)}>Como funciona</a><a className="nav-contact" href="#contato" onClick={()=>setMenuOpen(false)}>Vamos conversar <Icon name="diagonal" size={16}/></a>
      </div>
    </nav></header>
    <main id="conteudo">
      <section className="hero container" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow"><span/> Tecnologia feita para o seu negócio</p><h1 id="hero-title">Sua operação,<br/>em <em>outro nível.</em></h1><p className="lead">Sites, sistemas e automações que transformam processos soltos em uma experiência simples. Para você, sua equipe e seus clientes.</p><div className="hero-actions"><a className="button primary" href="#contato">Vamos tirar sua ideia do papel <Icon name="arrow" size={18}/></a><a className="text-link" href="#servicos">Explore as soluções <span>↓</span></a></div><div className="hero-note"><span className="note-line"/>Feito sob medida. Pensado para o dia a dia.</div></div><ProductPreview/></section>
      <div className="capabilities container"><span>DA PRESENÇA À OPERAÇÃO</span><div><span>Sites que apresentam</span><i/><span>Sistemas que organizam</span><i/><span>Fluxos que conectam</span></div></div>
      <section className="solutions light-section" id="servicos"><div className="container"><Reveal className="section-heading"><div><p className="eyebrow">01 / O que construímos</p><h2>O próximo passo do seu negócio<br className="desktop-break"/> começa com a ferramenta certa.</h2></div><p>Do primeiro contato ao processo interno.<br/>Cada solução tem um papel. Todas partem da sua realidade.</p></Reveal><div className="service-grid">{services.map(s=><Reveal className="service" as="article" key={s.n}><div className="service-top"><span className="service-icon"><Icon name={s.icon} size={24}/></span><span>{s.n}</span></div><p className="service-subtitle">{s.subtitle}</p><h3>{s.title}</h3><p className="service-description">{s.text}</p><div className="tags">{s.tags.map(t=><span key={t}>{t}</span>)}</div><a href="#contato" className="service-link">{s.link}<Icon name="diagonal" size={19}/></a></Reveal>)}</div></div></section>
      <section className="case-section container" id="prova" aria-labelledby="depoimentos-title">
        <Reveal className="case-intro">
          <p className="eyebrow">02 / Quem confia na ArtiSys</p>
          <h2 id="depoimentos-title">Depoimentos<br/>de clientes.</h2>
          <p>Conheça a experiência de empresas que usam nossas soluções no dia a dia.</p>
        </Reveal>
        <Reveal className="case-board testimonial" as="article">
          <div className="case-board-heading"><span className="small-caps">Cliente ArtiSys</span><span className="case-tag">Construção civil</span></div>
          <div className="case-company"><span className="company-monogram">MH</span><div><h3>MH Hidráulica LTDA</h3><span>Ribeirão Preto, SP</span></div></div>
          <p className="testimonial-label">Resumo da experiência</p>
          <p className="testimonial-text">Da obra ao escritório, a MH Hidráulica utiliza soluções desenvolvidas pela ArtiSys para organizar frentes de trabalho, presença, documentos e rotinas de gestão.</p>
          <div className="testimonial-services" aria-label="Soluções utilizadas pelo cliente"><span>Gestão de obras</span><span>Financeiro e documentos</span><span>Capacitação da equipe</span></div>
        </Reveal>
      </section>
      <section className="process-section container" id="processo"><Reveal className="section-heading"><div><p className="eyebrow">03 / Como trabalhamos</p><h2>Próximo de você.<br/>Em cada etapa.</h2></div><p>Clareza para começar.<br/>Espaço para ajustar. Cuidado para entregar.</p></Reveal><div className="process-grid">{[['01','Primeiro, a sua realidade.','Entendemos seu negócio, os processos e o que precisa melhorar. O problema orienta a solução.'],['02','Depois, a ideia ganha forma.','Construímos uma primeira versão visual e funcional. Você acompanha, experimenta e participa dos ajustes.'],['03','Por fim, pronta para a rotina.','Refinamos os detalhes e preparamos a entrega para o uso no dia a dia, com orientação para começar.']].map(([n,title,text])=><Reveal as="article" className="process-step" key={n}><div className="step-track"><span>{n}</span><i/></div><h3>{title}</h3><p>{text}</p></Reveal>)}</div></section>
      <section className="contact-section" id="contato"><Reveal className="contact-inner container"><p className="eyebrow">Sua próxima versão começa aqui</p><h2>Uma boa conversa.<br/><em>Um novo começo.</em></h2><p>Conte o que você quer melhorar no seu negócio.<br/>Vamos entender juntos qual solução faz sentido.</p><a className="button contact-button" href={whatsappUrl} target="_blank" rel="noreferrer">Conversar sobre meu projeto <Icon name="diagonal" size={20}/></a><span className="contact-note">Sites · Sistemas · Automações</span></Reveal></section>
    </main>
    <footer className="footer container"><div><a href="#topo" aria-label="ArtiSys, voltar ao início"><img src="/artisys-logo.svg" width="560" height="192" alt="ArtiSys"/></a><p>Tecnologia com propósito. Feita para você.</p></div><div className="footer-links"><a href={instagramUrl} target="_blank" rel="noreferrer">Instagram <Icon name="diagonal" size={14}/></a><a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp <Icon name="diagonal" size={14}/></a><a href="#topo">Voltar ao topo ↑</a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} ArtiSys</span><span>Your System Factory</span></div></footer>
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
