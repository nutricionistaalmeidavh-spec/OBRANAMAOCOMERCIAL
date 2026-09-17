import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const source=()=>readFile(new URL('./owner.ts',import.meta.url),'utf8');

describe('Central Artisys Loja Online contract',()=>{
  it('expõe Loja Online como terceiro produto gerenciado',async()=>{
    const text=await source();
    expect(text).toContain("'loja'");
    expect(text).toContain('Loja Online');
    expect(text).toContain('/api/owner/loja-online/overview');
    expect(text).toContain('/api/owner/loja-online/companies');
  });

  it('mantém provisionamento empresarial e ações de licença na Central',async()=>{
    const text=await source();
    expect(text).toContain('Criar loja e liberar licença');
    expect(text).toContain('Estender +6 meses');
    expect(text).toContain('Bloquear');
    expect(text).toContain('Desbloquear');
    expect(text).toContain('Máximo de usuários');
  });

  it('inclui Loja Online nos clientes e auditoria unificados',async()=>{
    const text=await source();
    expect(text).toContain('value="loja-online"');
    expect(text).toContain("'loja-online'");
    expect(text).toContain('/api/owner/loja-online/license-audit');
  });
});
