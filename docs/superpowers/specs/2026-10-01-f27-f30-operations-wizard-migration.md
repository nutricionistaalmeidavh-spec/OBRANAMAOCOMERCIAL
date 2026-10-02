# F27–F30 — Operação, administração, assistente e migração assistida

## Dependência

Esta entrega é empilhada sobre F25/F26 (`feat/f25-f26-remote-secure-transport`) e preserva F18–F26.

## F27 — Backup operacional

O motor canônico continua sendo `CentralBackupService` / `RuntimeBackupService`. Não existe segundo motor de backup.

A camada operacional acrescenta:

- scheduler explícito, com timer `unref`;
- default de 24 horas;
- retenção default de 7 backups;
- criação manual passando pelo mesmo caminho create → verify → prune;
- backup `pre-upgrade`;
- listagem gerenciada sem paths;
- teste de restore em cópia temporária, sem substituir o banco ativo;
- restore real continua usando `restoreManaged`, incluindo safety backup e recuperação automática.

Configuração:

```text
OBRA_NA_MAO_SERVER_BACKUP_ENABLED=true
OBRA_NA_MAO_SERVER_BACKUP_INTERVAL_HOURS=24
OBRA_NA_MAO_SERVER_BACKUP_RETENTION=7
```

Windows e Linux recebem esses defaults nos templates oficiais.

## F28 — Administração operacional

Nova visão autenticada Admin agrega somente dados allowlisted:

- versão/API;
- runtime mode/transport;
- readiness;
- saúde/integridade/schema do SQLite;
- política e estado do backup;
- dispositivos ativos/revogados;
- revision/refresh/staleness da autoridade Cloud;
- estado do sync por authority snapshot;
- capabilities do Server.

Rotas operacionais:

- `GET /api/v1/admin/operations`;
- `GET /api/v1/admin/storage/backups`;
- `POST /api/v1/admin/storage/restore-test`;
- `POST /api/v1/admin/storage/pre-upgrade`.

As rotas existentes de create/verify/restore continuam válidas e Admin-only.

Nenhuma resposta operacional inclui paths de filesystem, tokens, hashes de credencial ou setup codes.

## F29 — Assistente de configuração

A UI usa uma jornada única e mantém os mecanismos já implementados:

1. Identificação;
2. Claim;
3. Storage;
4. Rede;
5. Backup;
6. Segurança;
7. Validação.

A jornada preserva:

- LAN host;
- discovery F22;
- conexão manual F23;
- pairing/reconnect F24;
- remote F25;
- HTTPS/VPN F26;
- permissões Cloud/F16.

Não existe fallback local silencioso.

## F30 — Migração assistida

A UI orquestra a ordem:

```text
core → operation → planning → finance → rh
```

e usa exclusivamente o `ModuleMigrationService` existente:

- `migrationPreflight`;
- `migrateModule`;
- `migrationStatus`;
- `rollbackModuleMigration`;
- `refreshModuleCapabilities`.

Não existe `forceCentralActive`, escrita direta de estado ou novo motor de migração.

O happy path expõe uma ação única. Estados técnicos, tentativas e rollback permanecem em “Detalhes técnicos”.

## Invariantes

- um único Server Core;
- um único SyncCoordinator;
- lan-client nunca sincroniza Cloud diretamente;
- SQLite nunca é compartilhado em rede;
- Cloud permanece autoridade de identidade/permissões;
- F14 revision/409 preservado;
- nenhum fornecedor pago obrigatório;
- nenhum merge/deploy/release automático;
- `DESKTOP_AUTO_RELEASE_ENABLED='false'`.
