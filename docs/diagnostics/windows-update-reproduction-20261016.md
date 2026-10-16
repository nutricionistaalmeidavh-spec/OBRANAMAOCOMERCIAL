# Reprodução Windows: falha de inicialização após atualizar

Data: 2026-10-16. Trabalho exclusivamente na branch
`diagnostic/windows-update-reproduction-20261016`.
Sem alteração no código de produção, merge em main ou publicação de release.

Resultado final: reproduzido também **UNKNOWN: unknown error, mkdir** no
aplicativo completo, após a atualização oficial, em DocumentRootService linha 24.
Evidência: [execução 38981187094](https://github.com/nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL/actions/runs/38981187094).

## O que foi demonstrado

O instalador oficial 2.1.1, acionado pelo updater original de uma instalação
2.0.0 funcional, remove arquivos de documentos armazenados dentro do diretório
de instalação. O banco SQLite fora dessa pasta permanece íntegro, com a empresa
e o caminho UNC configurado preservados.

Quando o usuário tinha permissão para gravar na pasta DOCUMENTOS existente,
mas não para criar novas pastas no diretório protegido de instalação, o app
não consegue recriar DOCUMENTOS depois da atualização. O construtor original
de DocumentRootService lança uma exceção em mkdirSync na linha 24 e a aplicação
inteira abre sua tela de falha. A mensagem genérica sobre banco de dados é
enganosa nesse caso: o banco foi aberto; a falha é posterior, na pasta.

Isso também ocorre abrindo diretamente o executável novo 2.1.1; não depende
de um atalho antigo. Em outro cenário, o instalador preservou um atalho
preexistente apontando a uma cópia 1.0.18 e reabriu essa cópia automaticamente.
Esse segundo mecanismo explica como uma atualização pode terminar abrindo
outro executável, mas não comprova que existia esse atalho no computador do cliente.

## Experimentos executados

| Execução | Cenário | Resultado observado |
| --- | --- | --- |
| [38979817186](https://github.com/nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL/actions/runs/38979817186) | Documentos fora da instalação; reabertura automática | Arquivo preservado; 2.1.1 abre; firstRun=false |
| Mesma execução | Documentos dentro da instalação; runner administrador | Arquivo apagado; pasta vazia recriada; banco mantido |
| Mesma execução | Documentos dentro; atalho preexistente apontando a 1.0.18 | Arquivo apagado; atalho preservado; reabertura automática da 1.0.18 |
| [38980522423](https://github.com/nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL/actions/runs/38980522423) | Documentos dentro; reabertura da 1.0.18 sem privilégios | Tela real de falha; EPERM mkdir; pilha nas linhas 24, 60 e 228 |
| [38980854904](https://github.com/nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL/actions/runs/38980854904) | Documentos dentro; executável atualizado 2.1.1 sem privilégios | Tela real de falha; EPERM mkdir; linha 24 de DocumentRootService |
| Mesma execução | Controle: documentos fora; mesmo usuário sem privilégios | Pasta gravável antes e depois; documento preservado; 2.1.1 abre normalmente |
| [38981187094](https://github.com/nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL/actions/runs/38981187094) | A própria base do compartilhamento está em subpasta da instalação | Base removida pelo instalador; compartilhamento aponta para pasta inexistente; aplicativo completo 2.1.1 exibe UNKNOWN mkdir, na linha 24 |

No último cenário, o compartilhamento `obra-na-mao-desktop-commercial` apontava
para `C:\Program Files\ObraUpdateCI\obra-na-mao-desktop-commercial\shared-data`.
O caminho configurado era `\\runnervm0xl3a\obra-na-mao-desktop-commercial\DOCUMENTOS`.
Antes de atualizar, a conta comum conseguia abrir e gravar nesse caminho.
Depois, o instalador havia removido shared-data, mas o cadastro do compartilhamento
SMB e o endereço salvo no banco continuavam iguais. O Windows devolveu UNKNOWN
ao mkdirSync. O executável instalado foi confirmado como 2.1.1.0, o SQLite
retornou integrity_check=ok e a empresa de teste permaneceu cadastrada.

Nas execuções com usuário comum, uma conta local descartável recebe acesso
Modify à pasta DOCUMENTOS existente antes da atualização. Não recebe permissão
para criar pastas no diretório pai protegido. Não são alteradas permissões
nem removidos diretórios manualmente depois da atualização. A remoção vem
do instalador real. O teste exige que esse acesso funcione antes de atualizar.
A identidade efetiva do processo foi confirmada com whoami.exe na execução
38980854904, não inferida da variável de ambiente USERNAME herdada.

## Instrumentação e limites

- Instaladores oficiais 1.0.18, 2.0.0 e 2.1.1, sem recompilar ou editar o ASAR.
- SHA-512 da 2.1.1 conferido contra o artefato publicado:
  `PGdPKYdJ2849GlHjUwAZ3uZ9Oe1ff27NMpvgTwz+InYN2d5CidPnnp4KNumQ2hDVoFOAYoJzdx/UrXbaddDjyw==`.
- Feed do updater redirecionado apenas em memória para HTTP local, fixando a
  release oficial 2.1.1. As ações check, download e install usam a mesma API
  pública IPC utilizada pelo botão, incluindo quitAndInstall(false, true).
- O driver aciona os botões nativos Next/Finish do instalador. Nos ensaios de
  usuário comum, segura Finish para que o runner elevado não recrie a pasta
  apagada antes do teste, então abre o aplicativo como a conta comum.
- A sonda de construtor lê SQLite e usa fs reais. Substitui apenas dialog/shell
  não utilizados no construtor, para permitir Electron em modo Node.
  A confirmação decisiva é a janela do aplicativo completo, sem essa sonda,
  registrada em snapshot.json, screenshot.png e standard-full-app-error.log.
- Dados, conta, compartilhamento SMB e arquivos são exclusivamente fixtures
  da máquina Windows descartável. Nenhum dado do cliente foi usado nesses testes.
- Os artefatos do CI têm retenção de 14 dias; as receitas ficam na branch.

## Relação com a evidência do cliente

A foto mostra UNKNOWN mkdir no caminho UNC configurado, em DocumentRootService
linha 24, createServices linha 60 e main linha 228. A estrutura dessas linhas
corresponde à 1.0.18 oficial. O vídeo anterior mostra 2.0.0 funcionando.
Isso justifica investigar também qual executável o instalador realmente reabriu.

Os ensaios 38980522423 e 38980854904 retornaram EPERM. A variação 38981187094
reproduziu o código UNKNOWN da foto sem simular erros nem remover pastas
manualmente após a atualização. Não confundir as condições: se desaparece
apenas DOCUMENTOS e falta permissão para recriá-la, vimos EPERM; se desaparece
a própria base física do compartilhamento, vimos UNKNOWN.

Na reprodução UNKNOWN, a versão atualizada é 2.1.1, portanto as linhas de
main.cjs são 115 e 490, não 60 e 228 como na foto/1.0.18. O código UNKNOWN,
a operação mkdir e a linha 24 de DocumentRootService coincidem. Não se afirma
igualdade do computador, host, executável ou de toda a pilha do cliente.

Os experimentos comprovam uma falha real do fluxo de atualização nessas
condições. Não estabelecem sozinhos o destino físico do compartilhamento do
cliente nem que arquivos dele foram apagados. A letra C: na pilha identifica
o executável, não o destino físico de DOCUMENTOS no compartilhamento.

## Antes de mexer nos três computadores

Preservar o banco e as pastas existentes antes de reinstalar, restaurar,
mudar o caminho configurado ou repetir a atualização. Confirmar a propriedade
Path do compartilhamento e o TargetPath dos atalhos reais. Não apontar o app
para uma pasta vazia para apenas eliminar a tela de erro: isso não recupera
documentos nem valida os vínculos existentes.

A correção do instalador e a contenção da exceção de inicialização são problemas
distintos. Permitir que a interface abra não comprova preservação de documentos.
