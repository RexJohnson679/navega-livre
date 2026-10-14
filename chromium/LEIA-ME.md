# Navega Livre — versão experimental 0.1.0

Extensão local para Chrome e Edge no computador. Não é um executável nem uma versão assinada para Firefox. Não foi publicada em lojas.

## Instalar no Windows
1. Extraia o ZIP. Não selecione o ZIP dentro do navegador.
2. No Chrome, abra `chrome://extensions`. No Edge, abra `edge://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** / **Carregar descompactada**.
5. Selecione a pasta `navega-livre` que contém `manifest.json`.
6. Fixe a extensão pelo botão de extensões do navegador.
7. Recarregue as abas que já estavam abertas.

## O que funciona nesta versão
- Lista pequena de 16 domínios publicitários. Bloqueia pedidos de terceiros, sem bloquear navegação principal.
- Oculta espaços de publicidade conhecidos, inclusive elementos patrocinados da interface do YouTube.
- Filtro experimental para dados publicitários do player do YouTube: limpa apenas os campos `playerAds`, `adPlacements` e `adSlots` dos dados iniciais e de respostas JSON de endpoints específicos. Não modifica endereços, assinaturas ou dados de autorização de vídeos. Esse ajuste depende do formato usado pelo YouTube e pode exigir manutenção. Recarregue a aba após ativá-lo ou desativá-lo.
- Clica em **Pular anúncio** no YouTube quando o player indica um anúncio e o botão está disponível.
- Pode silenciar anúncios identificados; restaura o estado de áudio anterior depois deles. Esta opção começa desligada.
- **Tentar liberar aviso** procura camadas com mensagens explícitas sobre bloqueador. Ao usar o botão, ativa a repetição nesse domínio. Você pode desligar no painel.
- Adaptador específico para o aviso publicitário de `tavvkkj.xyz`, baseado no código analisado em 13/10/2026. Se o site mudar, pode parar de funcionar.
- Pausa global ou apenas no hostname atual, diagnóstico local e botão para recarregar.

## Limites reais
Não promete remover todos os anúncios de vídeo do YouTube. Não altera a duração, a velocidade nem os dados do vídeo, e não contorna bloqueios do player. Um anúncio sem botão de pular pode continuar sendo exibido.

Não há desbloqueio universal. Alguns sites não entregam o conteúdo ao navegador, e ocultar uma camada não cria esse conteúdo. Esta extensão não modifica login, VIP, assinatura ou autorização do servidor.

O bloqueio de rede usa uma lista inicial curta, não as listas completas de um bloqueador consolidado. Não garante eliminar todo anúncio ou rastreador. Adicione suporte a novos sites depois de analisar e testar cada caso.

Desativar esta extensão não desativa outros bloqueadores que você já usa. Se uma página quebrar, pause a proteção neste domínio e recarregue. Ajustes específicos feitos no estado da página só são desfeitos por recarga. Sites com molduras/iframes de outros domínios podem precisar de ajustes adicionais.

Os números do painel contam elementos ocultados e cliques em pular nesta página. Não são uma contagem de anúncios em vídeo removidos nem de pedidos de rede bloqueados. As contagens reiniciam ao recarregar.

## Testes e desenvolvimento
Código de funcionamento sem compilação e sem dependências externas. Arquivos principais: `background.js`, `content.js`, `youtube-main.js`, `common.js`, `popup.*` e `rules/advertising.json`.

Testes de configuração, lógica de página, filtro e serviço: `node --test tests/core.test.cjs tests/content.test.cjs tests/background.test.cjs tests/youtube.test.cjs`.

Validação executada: sintaxe JavaScript, estrutura do pacote e testes com DOM e APIs do navegador simulados. O ambiente de criação não disponibilizou um navegador completo: carregamento real, layout do painel, regras de rede reais e funcionamento no YouTube real ainda precisam de confirmação.

O teste `tests/browser.test.cjs` está incluído para testar em Chromium com páginas simuladas. Para executá-lo em um ambiente de desenvolvimento, instale Playwright e seu Chromium (`npm install --no-save playwright` e `npx playwright install chromium`), depois execute `node tests/browser.test.cjs`. Este teste não foi executado até o fim neste ambiente.

Antes de publicar, teste manualmente nas versões atuais de Chrome/Edge e em sites reais, revise permissões e adapte os textos às regras da loja. Não há aprovação de loja garantida.

Veja `PRIVACIDADE.md` para as permissões e dados utilizados. Todo código e toda regra executável vêm neste pacote. Não há servidor de atualizações próprio.
