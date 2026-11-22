import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {pendingRdoActions,recordCompensation} from '../public/field-rdo-workflow.js';
import {snapshotFreshness} from './summary-freshness';

const source=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const incomplete={
  attendanceMarked:0,finishedSessions:0,openSessions:0,materialsReviewed:false,
  occurrencesReviewed:false,photosReviewed:false
};
describe('P2 operational workflow and naming',()=>{
  it('enumerates every missing RDO section, not unrelated active production stages',()=>{
    expect(pendingRdoActions(incomplete).map(x=>x.key)).toEqual(['attendance','production','materials','occurrences','photos']);
    expect(pendingRdoActions({...incomplete,attendanceMarked:3,finishedSessions:1,openSessions:0,materialsReviewed:true,occurrencesReviewed:true,photosReviewed:true})).toEqual([]);
    expect(pendingRdoActions({...incomplete,attendanceMarked:3,finishedSessions:1,openSessions:2,materialsReviewed:true,occurrencesReviewed:true,photosReviewed:true}).map(x=>x.key)).toEqual(['production']);
  });
  it('tracks pending Desktop integration separately from unfinished RDO',()=>{
    expect(pendingRdoActions(incomplete,{status:'ready_for_desktop',confirmed:false}).map(x=>x.key)).toEqual(['integration']);
    expect(pendingRdoActions(incomplete,{status:'ready_for_desktop',confirmed:true})).toEqual([]);
  });
  it('does not reduce arbitrary employees or silently consume unassigned balances',()=>{
    const person={id:'e-2',name:'Pessoa QA',compensationDays:2};
    const result=recordCompensation(person,{date:'2026-11-22',id:'audit-1'});
    expect(result.employee).toEqual({...person,compensationDays:1});
    expect(result.event).toMatchObject({kind:'compensation',employeeId:'e-2',date:'2026-11-22',id:'audit-1',days:1});
    expect(person.compensationDays).toBe(2);
    expect(()=>recordCompensation({...person,compensationDays:0},{date:'2026-11-22',id:'audit-2'})).toThrow(/saldo/i);
    expect(()=>recordCompensation(person,{date:'22/11/2026',id:'audit-3'})).toThrow(/data/i);
  });
  it('labels older and missing snapshots explicitly, without claiming real-time data',()=>{
    const now=new Date('2026-11-22T16:00:00Z');
    expect(snapshotFreshness('2026-11-22T14:00:00Z',now).state).toBe('current');
    expect(snapshotFreshness('2026-11-19T14:00:00Z',now).state).toBe('stale');
    expect(snapshotFreshness('2027-11-19T14:00:00Z',now).state).toBe('unknown');
    expect(snapshotFreshness(null,now).state).toBe('unknown');
    expect(snapshotFreshness('2026-11-19T14:00:00Z',now).label).toMatch(/Desatualizad/);
  });
  it('presents all pending actions and sends the production CTA to the actual section',()=>{
    const field=source('../public/field.js');
    expect(field).toContain('pendingRdoActions(d');
    expect(field).toContain('rdo-next-items');
    expect(field).toContain('id="productionSessions"');
    expect(field).toContain("querySelector('#productionSessions')");
    expect(field).not.toContain('Compensar 2 primeiros');
    expect(field).toContain("window.multiuserContext?.role==='admin'");
  });
  it('uses canonical user-facing product names without changing persisted identifiers',()=>{
    const [html,gestao,field,portal]=[
      source('../sistema.html'),source('../gestao.html'),source('../public/field.js'),source('./portal.ts')];
    expect(html).toContain('Obra na Mão');
    expect(gestao).toContain('<title>Gestão · Obra na Mão</title>');
    expect(field).not.toContain('Frentes de serviço compartilhadas da obra.');
    expect(field).toContain('Vinculação por etapa');
    expect(portal).not.toContain("document.title='Canteiro360");
    expect(field).toContain('frentes_obra'); // Keep schema/API identifiers compatible.
  });
});
