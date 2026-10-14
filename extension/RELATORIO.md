# Revisão 0.4.0 — anúncios de página e pop-ups

## Evidência e correções

As imagens enviadas mostravam um anúncio flutuante e um diálogo pedindo instalar Ad Blocker Premium. Na inspeção pública do DOM do LycanToons, foram observados slots `ins.pubadx-slot`, frames A-Ads/PubADX e carregadores em `ppo.diveinthebluesky.biz`, `pa.diffgremio.com`, `acscdn.com` e `platform.pubadx.one`. O catálogo anterior não incluía essas quatro origens. Não foram copiados tokens, IDs de sessão, conteúdo de anúncios ou imagens do usuário para o repositório.

A nova proteção intercepta `window.open` no início da página, confere o destino escolhido em um clique e bloqueia diálogos de instalação falsos. Uma camada nativa identifica somente abas recém-criadas a partir de outra aba; destinos conhecidos de publicidade podem ser fechados nos primeiros 15 segundos. Não há fechamento por mensagem enviada pela página nem inspeção de abas preexistentes. Relações entre IDs e contadores são temporários e limitados.

Os filtros visuais usam os mesmos domínios publicitários das regras de rede. Reconhecem slots, frames, imagens e links conhecidos, inclusive anúncios inseridos depois do carregamento. Um contêiner flutuante só é colapsado quando contém apenas o anúncio e controles simples de fechar; não se sobe para o leitor, artigo, navegação ou raiz da aplicação.

## Validação

61 testes locais passaram na implementação. Há verificações específicas das APIs Chromium e Firefox, substituição por APIs compatíveis, pausa da página principal propagada para iframes, restauração de elementos, cliques falsos/automáticos, conservação de links e botões legítimos, diálogos normais, redirecionamentos de uma aba vazia e diagnóstico sem dados da página.

A automação de publicação exige ainda:

1. Builds de Chromium e Firefox e conferência de todos os bytes de cada arquivo dentro dos ZIPs.
2. Extensão instalada em Chromium: player, rede, pausa, avisos e painel; mais cenários de leitura, notícias e vídeo.
3. Extensão instalada temporariamente em Firefox: scripts MAIN/isolados, banners, anúncios flutuantes e dinâmicos, frames, cliques com aba extra, links e botões normais e diálogo falso.

O fluxo só libera a publicação se essas etapas passarem. Consulte o resultado do commit em GitHub Actions. Os cenários de navegador usam páginas locais controladas, com diferentes domínios e formatos. A inspeção do site real informou filtros; ela não equivale a instalar a nova extensão na conta/navegador do usuário. Não foi atribuída pontuação de benchmark nem garantia de remoção de todos os anúncios em sites reais.

## Compatibilidade

Scripts MAIN compartilhados não recebem APIs privilegiadas. As intervenções e o diagnóstico se referem explicitamente à janela da página, evitando confundir a janela com o global separado de scripts no Firefox. O teste do Firefox também verifica dados do player e leitura por WebDriver considerando seu sandbox. Preferências cruzam a fronteira do Firefox como texto JSON. O script recebe apenas o estado dessa página; fechamento de abas se baseia em eventos nativos e no catálogo local. A pausa desliga o comportamento nas abas já carregadas; recarregar aplica as regras às próximas requisições.

Aberturas assíncronas incomuns de um site podem precisar de uma exceção pelo controle de pop-ups. O Firefox continua com instalação temporária enquanto o pacote não for assinado. Os ajustes do player e os testes de regressão da 0.3.1 são mantidos.
