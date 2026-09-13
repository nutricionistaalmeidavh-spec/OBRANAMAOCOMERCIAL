# Entrega comercial 1.0.19 — 13/09/2026

Portal: https://obra-na-mao-comercial.nutricionistaalmeidavh.workers.dev/sistema.html#owner
Instalador completo: https://drive.google.com/file/d/1QmjxuBMfCAgjeg0gzGjUZKRfIgnxr04x/view

A Central Artisys lista empresas clientes e licenças reservadas, permite criar empresas com admin principal, módulos e canais e gerenciar a licença. A operação interna fica no link Minha operação. Os detalhes mostram usuários, obras, dispositivos e a data de criação da senha, inclusive quando ativada pelo desktop.

O desktop 1.0.19 oferece primeiro acesso por e-mail, código e senha e login por e-mail/senha; o Google continua disponível. O vínculo usa as APIs centrais, sem exigir acesso prévio ao site. O perfil local permanece vinculado à primeira empresa autenticada, inclusive após desconexão.

Validação: 158 testes web aprovados, incluindo serviço real do desktop contra Worker + SQLite e testes de concorrência/revogação. Desktop: tipos e build aprovados, 138 testes aprovados; 2 testes de symlink impedidos por EPERM no Windows local. SQLite nativo do executável empacotado validado com SELECT 1. Instalação interativa no computador do cliente ainda não realizada.

Instalador: Obra-na-Mao-Desktop-Setup-1.0.19.exe
Tamanho: 125560559 bytes
SHA256: 23ec25780d889c9852da78e4832bef63f78a3e67df062e66a44933368f505013
As partes 1.0.1 existentes no Drive foram preservadas. O arquivo 1.0.19 pode ser baixado e executado diretamente, sem recombinação.

Everton: licença verificada em produção antes e depois do deploy, active/lifetime-manual, companyId e claimedBy nulos. Continua aguardando primeiro acesso e não integra a operação do superadmin. Sua ativação real não foi consumida nos testes. O bootstrap da licença agora preserva alterações administrativas e vínculos existentes.
