import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Capability={id:string;critical:boolean;checks:string[]};
type MatrixEntry={id:string;business:boolean;uiRequired:boolean;backend:string[];surface:string;action:string;profiles:string[];e2e:string[];reason?:string};
const readJson=<T>(relative:string)=>JSON.parse(readFileSync(new URL(relative,import.meta.url),'utf8')) as T;
const manifest=readJson<{capabilities:Capability[]}>('../qa/business-capabilities.json');
const matrix=readJson<{entries:MatrixEntry[]}>('../qa/ui-capability-matrix.json');

describe('UI capability matrix',()=>{
  it('maps every release capability so none can become orphaned silently',()=>{
    const ids=new Set(matrix.entries.map(entry=>entry.id));
    expect(manifest.capabilities.filter(capability=>!ids.has(capability.id))).toEqual([]);
  });

  it('requires every business UI capability to name its surface, action, profile and executable evidence',()=>{
    for(const entry of matrix.entries.filter(item=>item.business&&item.uiRequired)){
      expect(entry.surface,entry.id).toBeTruthy();
      expect(entry.action,entry.id).toBeTruthy();
      expect(entry.profiles.length,entry.id).toBeGreaterThan(0);
      expect(entry.e2e.length,entry.id).toBeGreaterThan(0);
      expect(entry.backend.length,entry.id).toBeGreaterThan(0);
    }
  });

  it('keeps the new governance gaps bound to the browser transactional suite',()=>{
    for(const id of ['member-granular-entitlements-ui','tenant-device-management-ui','sync-observability-ui']){
      const entry=matrix.entries.find(item=>item.id===id);
      expect(entry?.uiRequired,id).toBe(true);
      expect(entry?.profiles,id).toContain('admin');
      expect(entry?.e2e,id).toContain('qa-admin-governance-transactional.mjs');
    }
  });

  it('keeps Electron pairing and bidirectional sync bound to renderer E2E',()=>{
    for(const id of ['desktop-pairing','desktop-mobile-sync']){
      const entry=matrix.entries.find(item=>item.id===id);
      expect(entry?.surface,id).toContain('Electron');
      expect(entry?.e2e,id).toContain('qa-desktop-renderer-transactional.mjs');
    }
  });
});
