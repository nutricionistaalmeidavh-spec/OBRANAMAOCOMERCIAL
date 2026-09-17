# Loja Online na Central Artisys — design de licenciamento

Data: 2026-09-17

## Objetivo

Adicionar a Loja Online como terceiro produto administrável em `artisys.dev/sistema#owner`, ao lado de Obra na Mão e Débora Lactação, reutilizando o padrão empresarial do Obra na Mão: provisionamento de tenant, administrador e licença a partir da Central Artisys.

A Central Artisys será a interface de operação. A Loja Online continuará sendo a autoridade sobre seus próprios tenants, usuários e licenças.

## Repositórios envolvidos

- Central Artisys / Obra na Mão: `nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL`
- Loja Online: `nutricionistaalmeidavh-spec/lojaonline`

## Estado atual relevante

### Central Artisys

A Central já possui áreas separadas para:

- Visão geral;
- Obra na Mão;
- Débora Lactação;
- Clientes;
- Licenças / auditoria.

O Obra na Mão usa provisionamento empresarial por empresa/tenant. A Débora Lactação usa licença individual por e-mail.

### Loja Online

A Loja Online já possui:

- arquitetura multitenant;
- criação de empresas e usuários;
- superadmin próprio;
- licenças por empresa;
- status ativo, vencido e bloqueado;
- extensão de licença;
- limite de usuários;
- bloqueio da vitrine pública quando a licença fica inativa;
- rotas `/api/v1/superadmin/*` e UI `/superadmin`.

Essas regras continuam sendo a fonte de verdade da Loja Online.

## Decisão arquitetural

Não duplicar a licença da Loja Online no D1 da Central Artisys.

A Central terá um adapter de administração que chama uma API interna da Loja Online. A Loja Online executa a operação, persiste tenant/licença no próprio banco e retorna uma representação administrativa para a Central.

Fluxo:

```text
Central Artisys (#owner)
        |
        | chamada autenticada interna
        v
Loja Online Worker
        |
        | FinalAppService / domínio de licenças
        v
D1 da Loja Online
```

Isso evita divergência entre dois bancos sobre `ACTIVE`, `EXPIRED`, `BLOCKED`, validade e limite de usuários.

## 1. API interna de licenciamento da Loja Online

Criar um namespace exclusivo para integração administrativa da Central:

```text
GET  /api/internal/artisys/loja-online/companies
GET  /api/internal/artisys/loja-online/companies/:companyId
POST /api/internal/artisys/loja-online/companies
PUT  /api/internal/artisys/loja-online/companies/:companyId/license
POST /api/internal/artisys/loja-online/companies/:companyId/extend
POST /api/internal/artisys/loja-online/companies/:companyId/block
POST /api/internal/artisys/loja-online/companies/:companyId/unblock
GET  /api/internal/artisys/loja-online/license-audit
```

### Criação de empresa

Entrada mínima:

```json
{
  "companyName": "Casa Silva",
  "adminName": "Carlos Silva",
  "adminEmail": "carlos@example.com",
  "months": 6,
  "maxUsers": 3,
  "plan": "6_MONTHS"
}
```

A operação deve ser atômica do ponto de vista da aplicação:

1. validar dados;
2. rejeitar e-mail já vinculado quando isso criaria ambiguidade;
3. criar tenant/empresa;
4. criar administrador;
5. vincular administrador à empresa;
6. criar licença `ACTIVE`;
7. definir `startsAt` e `expiresAt`;
8. registrar evento de auditoria;
9. retornar empresa, administrador e licença.

Se qualquer etapa falhar, a operação não deve deixar um tenant parcial utilizável.

### Renovação

A extensão deve preservar tempo restante.

Regra:

```text
base = max(now, expiresAt atual)
novo expiresAt = base + N meses
```

Para uma licença ainda válida, +6 meses significa +6 meses a partir do vencimento atual. Para uma licença já vencida, +6 meses significa +6 meses a partir de agora.

### Bloqueio e desbloqueio

Bloqueio deve reutilizar a regra nativa da Loja Online, de forma que:

- dashboard e operações autenticadas sejam bloqueados;
- vitrine pública do tenant também fique indisponível quando aplicável;
- desbloqueio restaure o acesso sem criar nova empresa/licença.

## 2. Autenticação Central Artisys → Loja Online

A API interna não usará sessão de cliente nem o login do superadmin da Loja Online.

### Mecanismo principal

Preferência: Cloudflare Service Binding entre o Worker da Central e o Worker da Loja Online, quando ambos estiverem no mesmo ambiente Cloudflare.

A chamada também deve exigir segredo compartilhado dedicado, por exemplo:

```text
LOJAONLINE_LICENSE_SERVICE_SECRET
```

O Worker da Central envia um header interno, por exemplo:

```text
X-Artisys-License-Secret: <segredo>
```

O Worker da Loja Online valida o segredo com comparação segura antes de qualquer operação.

### Regras de segurança

- nenhuma rota interna aceita sessão de cliente como substituto do segredo;
- segredo nunca vai para frontend;
- segredo existe apenas como secret do Worker;
- rotas internas não aparecem na navegação pública;
- requests sem segredo válido retornam `401` ou `403`;
- toda mutação registra ator `central-artisys` e ação de auditoria;
- dados sensíveis não entram em logs de erro.

### Fallback de ambiente

Para desenvolvimento local, o adapter poderá usar URL HTTP configurável da Loja Online mais o mesmo segredo. Em produção, Service Binding é o caminho preferido.

## 3. Adapter no backend da Central Artisys

Adicionar um módulo dedicado, sem misturar regras da Loja Online dentro de `owner-companies.ts`.

Responsabilidade do adapter:

- chamar API interna da Loja Online;
- normalizar erros;
- mapear resposta para o modelo da Central;
- não persistir uma segunda cópia da licença.

Interface conceitual:

```ts
interface LojaOnlineAdminAdapter {
  listCompanies(): Promise<LojaOnlineCompany[]>;
  getCompany(id: string): Promise<LojaOnlineCompany>;
  createCompany(input: CreateLojaOnlineCompanyInput): Promise<LojaOnlineCompany>;
  setLicense(id: string, input: SetLicenseInput): Promise<LojaOnlineCompany>;
  extendLicense(id: string, months: number): Promise<LojaOnlineCompany>;
  blockCompany(id: string, reason?: string): Promise<LojaOnlineCompany>;
  unblockCompany(id: string): Promise<LojaOnlineCompany>;
  listAudit(): Promise<LojaOnlineLicenseEvent[]>;
}
```

Rotas públicas do owner da Central ficam protegidas pelo mesmo middleware `secured` já usado no painel:

```text
GET  /api/owner/loja-online/overview
GET  /api/owner/loja-online/companies
GET  /api/owner/loja-online/companies/:id
POST /api/owner/loja-online/companies
PUT  /api/owner/loja-online/companies/:id/license
POST /api/owner/loja-online/companies/:id/extend
POST /api/owner/loja-online/companies/:id/block
POST /api/owner/loja-online/companies/:id/unblock
GET  /api/owner/loja-online/license-audit
```

O browser fala apenas com `/api/owner/*` da Central. Somente o backend da Central fala com `/api/internal/*` da Loja Online.

## 4. UI da Central Artisys

Adicionar `loja` como nova `OwnerView`.

### Visão geral

Novo card:

```text
Loja Online
N lojas
N ativas
[ Gerenciar ]
```

As métricas gerais passam a considerar os três produtos.

### Tela Loja Online

Formulário de provisionamento:

- nome da empresa/loja;
- nome do administrador;
- e-mail do administrador;
- plano;
- duração em meses;
- máximo de usuários.

Ações por cliente:

- abrir detalhes;
- estender licença;
- bloquear;
- desbloquear;
- alterar limite de usuários;
- consultar validade e status.

### Aba Clientes

Adicionar filtro `Loja Online` e cartões/linhas com:

- empresa;
- e-mail do administrador;
- status;
- plano;
- validade;
- número/limite de usuários.

### Aba Licenças / Auditoria

Agregar eventos da Loja Online ao histórico já unificado de Obra na Mão e Débora Lactação.

A Central apenas exibe eventos retornados pela Loja Online; não cria eventos paralelos representando a mesma operação.

## 5. Modelo administrativo retornado pela Loja Online

Formato normalizado sugerido:

```ts
type LojaOnlineCompany = {
  id: string;
  name: string;
  adminEmail: string;
  usersCount: number;
  license: {
    status: 'ACTIVE' | 'EXPIRED' | 'BLOCKED' | 'UNMANAGED';
    plan: string;
    startsAt: string | null;
    expiresAt: string | null;
    maxUsers: number;
    blockedReason?: string | null;
  };
};
```

A Central não deve inferir status a partir de datas. O status vem calculado pela Loja Online para manter uma única regra de negócio.

## 6. Compatibilidade

A implementação não altera:

- login do Obra na Mão;
- login da Débora Lactação;
- autenticação atual da Loja Online;
- tenants existentes;
- licenças existentes;
- `/superadmin` da Loja Online;
- fluxo de cliente do Obra na Mão;
- fluxo de licença individual da Débora.

O `/superadmin` próprio da Loja Online permanece como contingência e ferramenta técnica.

## 7. Erros e idempotência

### Criação duplicada

Se a Central repetir uma criação por timeout/retry, a Loja Online não deve gerar duas empresas para o mesmo pedido lógico.

A API deve aceitar `requestId`/`idempotencyKey` opcional e persistir/validar o resultado da operação. Se a mesma chave for repetida, retorna o resultado original.

### Falha da Loja Online

Se o Worker da Loja Online estiver indisponível:

- a Central mostra erro operacional;
- não grava licença local de compensação;
- não mostra sucesso até receber confirmação da autoridade.

### Timeout

Mutação com resultado incerto deve poder ser consultada por `requestId` antes de ser repetida.

## 8. Auditoria

Cada mutação deve registrar na Loja Online:

- timestamp;
- empresa;
- licença;
- ação;
- ator `central-artisys`;
- requestId;
- payload administrativo mínimo, sem senha ou segredo.

A Central agrega esse histórico com os demais produtos.

## 9. Testes obrigatórios

### Loja Online

- rejeita chamada interna sem segredo;
- cria tenant + admin + licença ativa;
- impede criação duplicada por idempotency key;
- lista empresas sem vazamento entre tenants;
- renova a partir do vencimento atual quando ainda válido;
- renova a partir de agora quando vencido;
- bloqueia e desbloqueia;
- aplica limite de usuários;
- bloqueia catálogo público quando licença fica inativa;
- mantém `/superadmin` atual funcional.

### Central Artisys

- adapter envia segredo somente no backend;
- erros da Loja Online são normalizados;
- card Loja Online aparece na visão geral;
- provisionamento cria tenant real na Loja Online;
- Clientes filtra os três produtos;
- Licenças agrega auditoria dos três produtos;
- falha remota não gera falso sucesso.

### E2E cross-repo

Cenário mínimo:

1. superadmin entra em `artisys.dev/sistema#owner`;
2. abre Loja Online;
3. cria empresa por 6 meses;
4. Central recebe confirmação;
5. administrador criado consegue entrar na Loja Online;
6. tenant criado aparece na Central;
7. extensão +6 meses atualiza validade;
8. bloqueio corta acesso;
9. desbloqueio restaura acesso;
10. evento aparece no histórico da Central.

## 10. Sequência de implementação

1. adicionar contrato/testes da API interna na Loja Online;
2. implementar autenticação interna e rotas administrativas na Loja Online;
3. adicionar auditoria/idempotência na Loja Online;
4. implementar adapter no backend da Central;
5. expor rotas `/api/owner/loja-online/*`;
6. adicionar `loja` à UI `owner.ts`;
7. integrar Loja Online em Visão geral, Clientes e Licenças;
8. configurar Service Binding/segredo de produção;
9. executar testes unitários/contrato dos dois repositórios;
10. executar E2E cross-repo antes de merge/deploy.

## Critérios de aceite

A entrega está concluída quando:

- Loja Online aparece na Central Artisys como terceiro produto;
- uma empresa Loja Online pode ser provisionada pela Central;
- tenant, admin e licença são criados somente na autoridade da Loja Online;
- licença pode ser consultada, estendida, bloqueada e desbloqueada pela Central;
- Clientes e Licenças exibem Loja Online junto dos outros produtos;
- nenhum fluxo existente de Obra na Mão ou Débora é alterado;
- `/superadmin` da Loja Online continua funcional;
- testes dos dois repositórios e E2E cross-repo passam.
