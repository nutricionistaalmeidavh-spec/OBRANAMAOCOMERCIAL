# Obra na Mão — Compatibilidade de armazenamento, identidade e Cloud (Fases 6–7)

## Objetivo

Evoluir a fundação de servidor local já existente sem descaracterizar o produto atual. O Obra na Mão continua sendo entregue como Desktop + camada Web/PWA vinculada à mesma conta; os novos modos de armazenamento alteram onde a fonte operacional principal reside, mas não substituem nem desativam os fluxos online existentes.

Esta especificação cobre somente as Fases 6 e 7 do roadmap revisado.

## PRINCÍPIOS INEGOCIÁVEIS

> **Nenhuma implementação de servidor local, servidor próprio, servidor remoto ou armazenamento Cloud pode remover, substituir ou alterar silenciosamente os fluxos atuais `Desktop ↔ Cloudflare/D1 ↔ PWA`.**
>
> **Funcionalidades Web/PWA que já fazem parte do Obra na Mão continuam incluídas no produto. Recursos pagos de Cloud devem ser sempre adicionais, principalmente armazenamento de documentos, PDFs, fotos, backups, restauração e novas capacidades — nunca cobrança por algo que o cliente já possui hoje.**

Regras derivadas:

- Clientes existentes atualizados continuam com login, vínculo Desktop, PWA e sincronização atual funcionando sem contratação adicional.
- A fonte operacional e a camada online são conceitos diferentes. Mudar a fonte operacional não desliga o vínculo Cloudflare.
- Usuário administrador não é definido pela máquina que hospeda os dados. Identidade, papel e permissões são independentes do papel da máquina.
- O plano Cloud pago é um adicional de capacidade e serviços; não é requisito para os recursos Web/PWA atualmente incluídos.
- Não criar uma segunda sincronização paralela enquanto o fluxo atual puder ser reutilizado ou adaptado.

## Estado real a preservar

### Identidade e conexão online

O `OnlineService` do Desktop usa por padrão o Worker Cloudflare do Obra na Mão, mantém `installationId`, token de dispositivo e vínculo de tenant local, e expõe login/vínculo/sessão sem entregar o token ao renderer.

Fluxo atual:

```text
Desktop
  ↓ OnlineService
Cloudflare Worker
  ↓
Conta / empresa / obra / dispositivo
  ↕
Web/PWA
```

### Sincronização Desktop ↔ online

O `SyncCoordinator` atual:

- mantém escopo explícito de uma empresa/obra/dispositivo;
- usa outbox SQLite local e revisões para reenvio idempotente;
- publica bridge operacional;
- publica resumo mobile;
- publica referências financeiras quando autorizado;
- faz pull das alterações de campo/PWA;
- registra e exige revisão de conflitos antes de substituir dados locais.

Bridge operacional atualmente efetiva no coordenador:

- `frentes_obra` → `fronts`;
- `tarefas_obra` → `tasks`;
- `rdos` → `rdos`;
- `cronograma_etapas` → `schedule`.

O contrato compartilhado também reconhece entidades de RDO relacionadas, mas o comportamento efetivo do coordenador deve ser tratado como a baseline até migração deliberada.

O backend/PWA já possui fluxo bidirecional comprovado por testes: Desktop faz push para `/api/desktop/sync/push`, o campo/PWA altera o bridge e o Desktop recupera via `/api/desktop/sync/pull`.

### Ponto crítico descoberto

Hoje o `SyncCoordinator` lê diretamente o `DatabaseService`/SQLite local. Nas fases 3–5, `Empresas`, `Clientes` e `Obras` passaram a poder ser roteados pelo `DataAccessService` para o servidor LAN, mas a sincronização existente ainda permanece acoplada ao banco local.

Portanto, ativar uma fonte operacional remota para uma obra não pode simplesmente reapontar a interface e assumir que a sincronização Cloudflare acompanha essa mudança. A Fase 6 deve primeiro proteger o comportamento atual e registrar esse acoplamento como fronteira arquitetural.

## Modelo conceitual final

Três eixos independentes:

```text
1. Fonte operacional
   - local
   - servidor LAN hospedado neste PC
   - servidor LAN existente
   - servidor remoto próprio

2. Identidade e autorização
   - conta/usuário
   - papel
   - permissões
   - dispositivo autorizado

3. Serviços online
   - Web/PWA atual incluído
   - sincronização atual incluída
   - Cloud adicional opcional/pago
```

Nenhum eixo define automaticamente o outro.

Exemplos válidos:

```text
PC do administrador + servidor LAN existente + usuário admin + PWA incluída
PC de engenharia + mesmo servidor LAN + usuário engenharia + PWA incluída
PC individual + SQLite local + usuário proprietário + PWA incluída
Servidor remoto próprio + usuário admin em notebook + PWA incluída
```

## Fase 6 — Proteção formal da arquitetura atual

### Objetivo

Criar uma barreira de regressão antes de ampliar o roteamento remoto.

### Trabalho

1. Documentar no `PROJECT_MAP.md` os invariantes acima e o mapa real da sincronização atual.
2. Criar testes de regressão no Desktop que comprovem que a configuração de armazenamento não altera o estado/vínculo online existente.
3. Criar testes de contrato que fixem a independência entre `storage` e `online` no processo principal/preload.
4. Reforçar testes Web existentes do ciclo Desktop → Cloud → campo/PWA → Desktop, sem mudar endpoints nem semântica.
5. Registrar explicitamente que o `SyncCoordinator` ainda depende do SQLite local e que uma futura fonte operacional remota deverá fornecer os dados ao mesmo pipeline de sincronização, em vez de criar outro pipeline.

### Não fazer nesta fase

- não migrar o `SyncCoordinator` para o servidor LAN ainda;
- não alterar endpoints Cloudflare atuais;
- não mudar o comportamento da PWA;
- não mudar preços, planos ou entitlement existentes;
- não habilitar R2 ou upload pago;
- não criar autenticação LAN nova ainda;
- não migrar mais módulos para o servidor.

### Critérios de aceite

- Modo local continua com o mesmo vínculo online atual.
- Configurar LAN/remoto não apaga nem altera `online-connection.json`, token, tenant ou URL online.
- `window.fluxoDre.storage` e `window.fluxoDre.online` permanecem contratos independentes.
- Os testes Web existentes continuam provando Desktop → Cloud → PWA/campo → Desktop.
- Qualquer futuro roteamento remoto que tente desativar a sincronização existente deve quebrar um teste de regressão.

## Fase 7 — Separação formal dos três conceitos

### Objetivo

Parar de usar um único `mode=local|server` como descrição completa da instalação. O sistema deve distinguir papel da fonte operacional, identidade/autorização e serviços online.

### Modelo de fonte operacional

Introduzir um modelo explícito, inicialmente compatível com a configuração existente:

```ts
type OperationalStorageMode =
  | 'local'
  | 'lan-host'
  | 'lan-client'
  | 'remote'
```

Significado:

- `local`: todos os dados operacionais permanecem neste computador;
- `lan-host`: este computador também hospeda o serviço servidor;
- `lan-client`: este computador usa outro servidor da rede da empresa;
- `remote`: este computador usa servidor remoto próprio pela internet.

A configuração atual `storage_mode=server` deve ser migrada de forma compatível, sem perder host/porta nem mudar automaticamente clientes existentes. Enquanto a UX final não for introduzida, `server` pode ser interpretado como `lan-client` internamente por adaptador de compatibilidade.

### Modelo de identidade

Não criar um segundo conceito de administrador ligado ao LAN Server. A identidade online já possui empresa, projeto, dispositivo, membro/role e módulos de acesso. A arquitetura futura deve reutilizar ou integrar esse modelo, em vez de duplicar administradores LAN e Cloud sem necessidade.

Regra:

```text
papel da máquina != papel do usuário
```

Um usuário `admin` pode estar em qualquer Desktop conectado a qualquer fonte operacional autorizada.

### Modelo de serviços online

Registrar estado separado da fonte operacional:

```ts
type OnlineServicesState = {
  webPwaIncluded: true
  linked: boolean
  syncConfigured: boolean
  cloudStoragePlan?: 'none' | string
}
```

`webPwaIncluded` é uma propriedade de produto/compatibilidade, não um toggle pago introduzido por estas fases.

O eventual `cloudStoragePlan` representa somente capacidade adicional futura e não interfere em login, PWA ou sincronização básica existente.

### UX conceitual futura

A tela de armazenamento deve evoluir para:

```text
Onde os dados operacionais ficam?

○ Somente neste computador
○ Neste computador e compartilhados na rede
○ Em outro servidor da empresa
○ Em um servidor remoto próprio
```

Separadamente, a tela continua mostrando a conexão Obra na Mão Web/PWA atual.

Quando existir Cloud adicional:

```text
Obra na Mão Web/PWA       Ativo / incluído
Armazenamento Cloud       Não contratado | plano contratado
```

A Fase 7 pode introduzir o modelo e os contratos sem concluir toda a UX dos quatro casos; instalação automática do servidor, descoberta, autenticação LAN, permissões e servidor remoto continuam em fases posteriores.

## Estratégia de compatibilidade

Para evitar quebra de instalações existentes:

```text
configuração antiga
storage_mode=local
→ OperationalStorageMode=local

storage_mode=server
→ OperationalStorageMode=lan-client
```

Host e porta existentes são preservados.

A configuração online (`online-connection.json`) não participa dessa migração.

## Estratégia para a sincronização futura

O objetivo posterior não é:

```text
Desktop LAN → nova sincronização → Cloudflare
```

em paralelo ao pipeline atual.

O objetivo é:

```text
Fonte operacional escolhida
        ↓
adaptador de leitura/escrita
        ↓
SyncCoordinator / contrato de sincronização existente
        ↓
OnlineService
        ↓
Cloudflare/D1 ↔ PWA
```

O `SyncCoordinator` poderá precisar deixar de conhecer diretamente `DatabaseService` e receber um provider de dados sincronizáveis. Essa alteração fica fora das Fases 6–7 e só deverá ocorrer com testes de equivalência do pipeline atual.

## Cloud adicional futuro

Não faz parte da implementação das Fases 6–7, mas a arquitetura reserva uma camada adicional:

```text
Cloud incluído atualmente
- conta/login
- Web/PWA
- bridge e resumos já existentes
- D1 necessário aos recursos atuais

Cloud opcional/pago futuro
- documentos e PDFs em R2
- fotos e anexos
- backup online
- restauração
- histórico ampliado
- capacidades premium novas
```

Nenhuma funcionalidade presente hoje pode ser movida para o bloco pago apenas por causa desta reorganização.

## Testes obrigatórios antes de concluir as fases

Desktop:

- regressão `storage` vs `online`;
- configuração antiga `local|server` continua legível;
- novo modelo não muda o default local;
- preload/IPC não mistura contratos de storage e online;
- `npm run lint`;
- `npm test`;
- `npm run build`.

Web/PWA:

- fluxo Desktop → Cloud → campo/PWA → Desktop permanece verde;
- autorização por empresa/obra/dispositivo permanece verde;
- nenhum endpoint existente é removido ou renomeado.

## Fora do escopo

- serviço Windows automático;
- descoberta LAN;
- pareamento LAN;
- nova matriz de permissões LAN;
- migração dos demais módulos para o servidor;
- servidor remoto HTTPS;
- R2/documentos Cloud;
- cobrança/assinatura;
- sincronização offline multi-PC.
