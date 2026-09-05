# Entrega comercial — integração e UX

Base: c321c732fd3a42a1693b0000dc030e29a765f2e5. Somente edição comercial; MH intacta.

## Implementado
- Margens negativas corretas, status explícitos, folha sem falso salvamento, modais com teclado/foco.
- Navegação com busca, favoritos/grupos, contexto persistido, atalhos financeiros e jornada RH.
- Sincronização em SQLite com vínculo explícito local/online, reenvio, auditoria, conflitos e estado em Configurações.
- Resumo financeiro baseado em pagamentos reais e obrigações da obra selecionada. Bridge operacional por ID/dispositivo, sem correspondência por nome.
- Web: rascunhos administrativos isolados por identidade, reenvio, links para seções da Gestão e lifecycle visual explícito.

## Para ativar após instalar/publicar

Validação local final: 66 testes Desktop + 88 testes web aprovados; lint TypeScript e builds de ambas as aplicações aprovados; 549 imagens canônicas verificadas. Build desktop mantém aviso não bloqueante de bundle acima de 500 kB.
1. Atualização enviada à main comercial conforme autorização; os pipelines existentes validam e geram os instaladores. O Cloudflare acompanha o repositório pelo fluxo existente.
2. Instalar o desktop atualizado; migration 017 é aplicada com backup prévio existente.
3. Em Configurações, vincular o computador, selecionar empresa/obra locais e conferir o destino online antes de ativar.
4. Validar um registro em desktop → celular → desktop e um conflito controlado antes de uso operacional.

## Limites declarados
- Não gerados novos instaladores nesta entrega; não executada sessão visual autenticada.
- Rascunhos web administrativos usam comparação pré-envio; a API de snapshot ainda não oferece CAS atômico contra escritores simultâneos. Não é fila offline completa para encarregado.
- Assinaturas RH continuam com conferência manual. Refatoração completa dos grandes módulos foi adiada para preservar escopo.
- A sincronização operacional aplica apenas os campos da bridge suportados por ID; demais dados de campo ficam no snapshot local. Não há importação automática de pessoas por nome.
- Nenhuma alteração na instalação MH nem no DNS/domínio Hostinger. Publicação web pelo fluxo Git → Cloudflare existente.
