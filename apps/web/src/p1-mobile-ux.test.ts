// @vitest-environment happy-dom
import {beforeEach,describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {renderManagementDashboard} from './mobile-dashboard';
import {portalOverviewLoading} from './portal-overview';

const source=(relative:string)=>readFileSync(new URL(relative,import.meta.url),'utf8');
const access={modules:['dre','documents','obra360','rdo'],channels:['mobile']};

describe('P1 mobile UX stability',()=>{
  beforeEach(()=>{document.body.innerHTML='<main id="content"></main>';location.hash='#gestao'});

  it('reserves the same KPI structure before and after the management summary resolves',()=>{
    const root=document.getElementById('content')!;
    renderManagementDashboard(root,{},access,'Gestão',true);
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(root.querySelectorAll('.management-kpi')).toHaveLength(3);
    expect(root.querySelector('.management-hero')).not.toBeNull();
    expect(root.querySelector('.management-details')).not.toBeNull();
    expect(root.textContent).toContain('Carregando indicadores');
    renderManagementDashboard(root,{modules:{dre:{revenue:100000,expense:45000},documents:{expiring30d:2}}},access,'Gestão');
    expect(root.getAttribute('aria-busy')).toBe('false');
    expect(root.querySelectorAll('.management-kpi')).toHaveLength(3);
    expect(root.textContent).toContain('R$');
  });

  it('reserves portal overview geometry before the asynchronous authorized aggregate arrives',()=>{
    const skeleton=portalOverviewLoading();
    expect(skeleton).toContain('cp-overview-skeleton');
    expect(skeleton).toContain('aria-busy="true"');
    expect(skeleton).toContain('cp-metrics');
    expect(skeleton).toContain('cp-summary');
    expect(skeleton).not.toContain('R$');
  });

  it('does not rewrite quick-action destinations after DOM paint',()=>{
    const field=source('../public/field.js'),enhancer=source('../public/field-premium-v2.js');
    expect(field).toContain('data-screen="settings"><strong>Configurações</strong>');
    expect(enhancer).not.toContain("dayButton.dataset.screen='settings'");
    expect(enhancer).not.toContain('shiftSecondaryActionsToObra360(actions)');
  });

  it('keeps all mobile actions readable and above the Safari inset',()=>{
    const css=source('../public/field-premium-v2.css');
    expect(css).toContain('/* P1 safe-area and readable navigation */');
    expect(css).toContain('--field-safe-bottom:env(safe-area-inset-bottom');
    expect(css).toContain('min-height:44px');
    expect(css).toContain('font-size:12px');
    expect(css).toContain('scroll-padding-bottom');
  });

  it('renders a usable Gestão shell before requesting the remote summary',()=>{
    const entry=source('./main.ts');
    const section=entry.slice(entry.indexOf('async function loadManagementOnly('),entry.indexOf('function injectAdminSettings('));
    expect(section).toContain("renderManagementDashboard(root(),{},b.access||{},'Gestão',true)");
    expect(section.indexOf("renderManagementDashboard(root(),{},b.access||{},'Gestão',true)")).toBeLessThan(section.indexOf("api.get('/api/mobile/summary')"));
    expect(section).toContain("renderManagementDashboard(root(),data.summary||{},b.access||{},'Gestão')");
  });
});
