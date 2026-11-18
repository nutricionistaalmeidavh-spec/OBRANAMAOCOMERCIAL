import {describe,it,expect} from 'vitest';
import {p0ProjectId} from './web-p0-project-provision';
describe('identidade determinística da obra Web P0',()=>{
  it('retorna o mesmo ID de projeto para retry do mesmo comando',()=>{
    expect(p0ProjectId('abababab-abab-4aba-8aba-abababababab')).toBe('p0work_abababababab4aba8abaabababababab');
  });
  it('recusa uma identidade diferente de UUID v4',()=>{
    expect(()=>p0ProjectId('xx')).toThrow();
    expect(()=>p0ProjectId('12345678-1234-1234-1234-123456789012')).toThrow();
  });
});
