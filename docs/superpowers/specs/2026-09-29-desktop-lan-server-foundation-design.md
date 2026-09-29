# Obra na Mão Desktop — LAN Server Foundation (Fases 0–2)

## Objetivo

Preparar o Obra na Mão Desktop para, futuramente, usar o servidor já existente de um cliente sem alterar o comportamento dos demais clientes. A instalação atual continua local por padrão. O modo servidor é opcional e configurável por instalação.

## Escopo desta entrega

Esta entrega cobre apenas as fases 0, 1 e 2 do roadmap aprovado:

1. **Fase 0 — seam de acesso a dados:** centralizar o CRUD genérico do processo principal em um serviço intermediário, preservando integralmente o SQLite local atual. Nenhuma entidade passa a usar HTTP nesta fase.
2. **Fase 1 — configuração Local/Servidor:** adicionar no Desktop uma configuração persistida com `mode`, `host` e `port`, mantendo `local` como padrão e permitindo testar a conexão com um servidor LAN.
3. **Fase 2 — serviço HTTP mínimo:** adicionar `apps/lan-server`, sem dependências pagas ou serviços externos, expondo `GET /health` e `GET /version`.

CRUD remoto de empresas, clientes e obras fica explicitamente fora deste escopo e começa nas fases 3–5.

## Invariantes

- Instalações existentes permanecem em modo `local` após atualização.
- O renderer continua sem acesso direto a Node.js, banco ou rede privilegiada; configuração e teste de conexão passam por `window.fluxoDre` → IPC → processo principal.
- O SQLite local existente continua sendo a fonte de dados de todas as telas nesta entrega.
- Não criar migration: a tabela genérica `configuracoes` já existente será usada para persistir as preferências de conexão.
- Nenhum serviço pago ou dependência externa obrigatória.
- O serviço LAN deve funcionar com Node.js 22 e módulos nativos.
- Porta padrão: `4732`.
- O processo LAN escuta `127.0.0.1` por padrão durante desenvolvimento; exposição em rede (`0.0.0.0`) será configuração explícita de implantação posterior.

## Fase 0 — Data Access seam

Criar `electron/services/data-access-service.cjs` com a interface CRUD já usada pelos handlers genéricos:

- `list(table, filters)`
- `get(table, id)`
- `save(table, data)`
- `remove(table, id)`

Nesta entrega o serviço delega 1:1 ao `DatabaseService`. `electron/main.cjs` deixa de chamar o banco diretamente nos handlers `entity:*` e passa por `services.dataAccess`.

Essa seam será o ponto de roteamento Local/Servidor nas fases posteriores, evitando reescrever as páginas do renderer.

## Fase 1 — Configuração Local/Servidor

Criar `StorageConnectionService` no processo principal. Estado público:

```ts
type StorageConnectionState = {
  mode: 'local' | 'server'
  host: string
  port: number
  baseUrl: string | null
}
```

Persistência em `configuracoes`:

- `storage_mode`
- `lan_server_host`
- `lan_server_port`

Defaults:

- `mode = 'local'`
- `host = '127.0.0.1'`
- `port = 4732`

O serviço valida:

- modo somente `local` ou `server`;
- host sem protocolo, caminho ou credenciais;
- porta inteira entre `1` e `65535`.

IPC/preload:

- `storage:state`
- `storage:configure`
- `storage:test-connection`
- `window.fluxoDre.storage.state()`
- `window.fluxoDre.storage.configure(input)`
- `window.fluxoDre.storage.testConnection()`

A tela `Configurações > Sistema` recebe um card **Dados e servidor** com:

- seleção `Neste computador` / `Servidor da empresa`;
- host;
- porta;
- botão para salvar;
- botão para testar conexão;
- feedback legível ao usuário.

Selecionar `server` nesta entrega **não muda o CRUD**. A própria interface deve deixar claro que somente módulos que suportarem rede usarão essa seleção; até as fases 3–5, os dados continuam locais.

## Fase 2 — Serviço HTTP LAN

Criar `apps/lan-server` como processo Node independente.

### `GET /health`

Resposta `200 application/json`:

```json
{
  "status": "ok",
  "product": "Obra na Mão",
  "apiVersion": "1"
}
```

### `GET /version`

Resposta `200 application/json`:

```json
{
  "product": "Obra na Mão",
  "apiVersion": "1",
  "serverVersion": "0.1.0"
}
```

Rotas desconhecidas retornam `404` em JSON. Métodos diferentes de `GET` retornam `405`.

Configuração do processo:

- `OBRA_NA_MAO_LAN_HOST` — default `127.0.0.1`;
- `OBRA_NA_MAO_LAN_PORT` — default `4732`.

O teste do Desktop consulta `http://<host>:<port>/health` com timeout de 3 segundos e só considera válida uma resposta com `status=ok`, `product=Obra na Mão` e `apiVersion=1`.

## Segurança e limites

- Nenhuma porta é aberta automaticamente no firewall nesta etapa.
- Nenhuma escuta em `0.0.0.0` por padrão.
- Nenhum token/chave de terminal ainda; autenticação é fase 6.
- Nenhum acesso público pela internet.
- Nenhuma sincronização offline.
- Nenhuma migração de banco.
- Nenhum CRUD HTTP nesta entrega.

## Critérios de aceite

- Atualizar um cliente existente não muda seu modo de dados: permanece `local`.
- CRUD existente continua funcionando pelo mesmo contrato `window.fluxoDre.*`.
- A configuração Local/Servidor pode ser salva e lida novamente.
- Host/porta inválidos são rejeitados antes de qualquer requisição.
- O Desktop consegue reconhecer o serviço LAN correto pelo `/health`.
- `apps/lan-server` responde corretamente a `/health` e `/version` e rejeita rotas/métodos fora do contrato.
- `npm run lint`, `npm test` e `npm run build` do Desktop permanecem verdes.
- O mapa estrutural do Desktop é atualizado para registrar o novo serviço, IPC e aplicativo LAN.
