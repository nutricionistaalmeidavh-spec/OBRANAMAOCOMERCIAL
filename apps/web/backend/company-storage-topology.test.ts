import {describe,expect,it} from 'vitest';
import {assertDesktopAdmission,desktopBindingForMember,normalizeCompanyStorageTopology} from './company-storage-topology';

describe('canonical company storage topology',()=>{
  it('keeps collaborator Desktop unavailable when the company is single-computer local',()=>{
    const topology=normalizeCompanyStorageTopology({mode:'local-single'});
    expect(desktopBindingForMember(topology,['mobile'])).toBeNull();
    expect(()=>desktopBindingForMember(topology,['desktop','mobile'])).toThrow(/vários computadores|servidor local/i);
  });

  it('binds every invited Desktop to the company LAN server identity',()=>{
    const topology=normalizeCompanyStorageTopology({mode:'lan-server',serverId:'server-company-01'});
    expect(desktopBindingForMember(topology,['desktop','mobile'])).toEqual({mode:'lan-server',serverId:'server-company-01',autoEnroll:true});
  });

  it('never accepts a LAN topology without a stable server id',()=>{
    expect(()=>normalizeCompanyStorageTopology({mode:'lan-server'})).toThrow(/servidor/i);
  });


  it('keeps single-computer mode exclusive to the principal and at most one active Desktop',()=>{
    const topology=normalizeCompanyStorageTopology({mode:'local-single'});
    expect(()=>assertDesktopAdmission(topology,{isPrincipal:false,otherActiveDevices:0})).toThrow(/computador principal|vários computadores/i);
    expect(()=>assertDesktopAdmission(topology,{isPrincipal:true,otherActiveDevices:1})).toThrow(/somente um computador|revogue/i);
    expect(assertDesktopAdmission(topology,{isPrincipal:true,otherActiveDevices:0})).toBe(true);
  });
});
