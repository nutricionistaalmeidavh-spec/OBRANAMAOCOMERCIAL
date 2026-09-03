import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canReadOverview, projectOverview, type OverviewAccess } from '../shared/portal-overview';
const request = vi.hoisted(() => vi.fn());
vi.mock('./cloudflare-client', () => ({ api:{ get:request } }));
import { loadPortalOverview } from './portal-overview';

const admin: OverviewAccess = {
  role:'admin', needsClaim:false,
  platformAccess:{ status:'active', systems:{ gestao:{ enabled:true, role:'consulta' } } },
  access:{ channels:['mobile'], modules:['dre','contracts','measurements','documents'] },
};
describe('Portal overview permissions and read model', () => {
  beforeEach(() => request.mockReset());
  it.each(['employee','foreman',undefined])('does not request or render Desktop data for %s', async role => {
    expect(await loadPortalOverview({ ...admin, role })).toBe('');
    expect(request).not.toHaveBeenCalled();
  });
  it.each([
    { platformAccess:null }, { needsClaim:true },
    { platformAccess:{ status:'blocked', systems:{ gestao:{ enabled:true, role:'admin' } } } },
    { platformAccess:{ status:'pending', systems:{ gestao:{ enabled:true, role:'admin' } } } },
    { platformAccess:{ status:'active', systems:{ gestao:{ enabled:false, role:'admin' } } } },
    { access:{ channels:['desktop'], modules:['dre'] } },
    { access:{ channels:['mobile'], modules:['obra360'] } },
  ])('fails closed when any permission is missing', async override => {
    expect(canReadOverview({ ...admin, ...override })).toBe(false);
    expect(await loadPortalOverview({ ...admin, ...override })).toBe('');
    expect(request).not.toHaveBeenCalled();
  });
  it('projects only the allowed aggregate fields, without employee or raw finance data', () => {
    const projected = projectOverview({ secret:'hidden', modules:{
      dre:{ result:999900 }, documents:{ expiring30d:3, files:[{secret:'hidden'}] }, rh:{ employees:[{salary:500000}] },
    } }, ['documents']);
    expect(projected).toEqual({ updatedAt:null, metrics:[], attention:[{key:'documents',label:'Documentos a vencer em 30 dias',value:3,kind:'count'}] });
  });
  it('preserves actual zero and negative results but does not invent missing or invalid values', () => {
    const projected=projectOverview({ modules:{ dre:{result:-10050},contracts:{active:0},measurements:{open:null},documents:{expiring30d:NaN} } },admin.access!.modules!);
    expect(projected.metrics.map(item=>item.value)).toEqual([-10050,0]);
    expect(projected.attention).toEqual([]);
    expect(projectOverview(null,admin.access!.modules!)).toEqual({updatedAt:null,metrics:[],attention:[]});
  });
  it('renders permitted figures in cents, timestamp and authorized pending counts', async () => {
    request.mockResolvedValue({data:projectOverview({generatedAt:'2026-09-03T14:20:00Z',modules:{dre:{result:5400000},measurements:{open:6}}},admin.access!.modules!)});
    const html=await loadPortalOverview(admin);
    expect(request).toHaveBeenCalledWith('/api/portal/overview');
    expect(html).toContain('54.000,00');expect(html).toContain('6 medições em aberto');expect(html).toContain('Desktop ·');
  });
  it('removes the summary on revoked access and offers retry only for operational failure', async () => {
    request.mockRejectedValueOnce({response:{status:403}});
    expect(await loadPortalOverview(admin)).toBe('');
    request.mockRejectedValueOnce(new Error('offline'));
    expect(await loadPortalOverview(admin)).toContain('Tentar novamente');
  });
});
