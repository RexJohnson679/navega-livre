# Navega Livre

Extensão para navegadores focada em redução local de anúncios, ajustes no YouTube e reparo de avisos de adblock.

**Versão 0.3.1 · Manifest V3 · Licença MIT**

O projeto reúne um núcleo compartilhado e builds próprios para Chromium e Firefox. As preferências e os filtros funcionam localmente, com controles para pausar a proteção por domínio, ajustar o YouTube e exportar um diagnóstico quando solicitado.

## Correção 0.3.1

Corrigida a chamada de atualização do script do player para a API documentada `scripting.updateContentScripts`. A versão anterior usava um nome inexistente, que causava a mensagem de erro mostrada no painel. A atualização evita registros repetidos sem necessidade e pode substituir o registro pelas APIs de remover/registrar quando o método de atualização não estiver disponível. O painel também reconhece o filtro antigo em abas já abertas. Esta correção não confirma remoção de todos os anúncios de vídeo; reprodução real ainda precisa ser validada.

## Funcionalidades

- Bloqueio de conexões para destinos conhecidos de publicidade, rastreamento e outros conteúdos indesejados: 3.059 domínios distintos nas listas locais.
- Lista adicional de rastreadores que pode ser desligada independentemente.
- Ocultação de espaços publicitários conhecidos, inclusive na interface do YouTube.
- Filtro experimental de metadados publicitários do player em dados iniciais e respostas `fetch` e `XMLHttpRequest` de endpoints específicos do YouTube.
- Clique no botão de pular quando disponível e silenciamento opcional, com restauração do áudio anterior.
- Ajuste opcional por domínio para avisos explícitos de bloqueador.
- Pausa global e por site, incluindo respeito à pausa da página principal em iframes.
- Painel com abas, navegação por teclado e estado de carregamento dos filtros.
- Diagnóstico local sem caminho, parâmetros ou fragmento da URL.

Os ajustes do YouTube são experimentais: anúncios de vídeo podem permanecer. O reparo de avisos depende de cada site e não modifica login, assinaturas ou autorização do servidor. As listas são snapshots locais, sem atualização remota automática. Consulte o [relatório da versão](extension/RELATORIO.md).

## Instalar

Não é necessário Node para instalar os pacotes prontos.

| Pacote | Navegadores | Mínimo declarado |
| --- | --- | --- |
| [Chromium 0.3.1](packages/navega-livre-chromium-v0.3.1.zip) | Chrome; Edge e Brave compatíveis com as APIs usadas | Chromium 120 |
| [Firefox 0.3.1](packages/navega-livre-firefox-v0.3.1.zip) | Firefox para computador | Firefox 128 |

Baixe o arquivo pelo botão de download na página do ZIP e extraia-o. Use uma só cópia do Navega Livre em cada navegador.

### Chrome, Edge e Brave

1. Abra `chrome://extensions`, `edge://extensions` ou `brave://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Escolha **Carregar sem compactação** e selecione a pasta `navega-livre` extraída.
4. Recarregue os sites abertos. Para o YouTube, feche as abas antigas e abra uma nova.

### Firefox

1. Abra `about:debugging#/runtime/this-firefox`.
2. Escolha **Carregar extensão temporária**.
3. Selecione o `manifest.json` do pacote Firefox extraído.
4. Abra uma nova aba do YouTube e confira os estados de rede e player no painel.

A instalação temporária termina ao reiniciar o Firefox. Instalação permanente exige um pacote assinado pela Mozilla; esta versão não foi publicada em lojas.

O [guia completo](extension/LEIA-ME.md) explica atualizações, controles e diagnóstico. A [política de privacidade](extension/PRIVACIDADE.md) descreve as permissões e os dados utilizados.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `extension/manifest.json` | Manifesto Chromium da origem; o build gera o manifesto Firefox. |
| `extension/background.js` | Preferências, listas de rede, registro do filtro e diagnóstico. |
| `extension/common.js`, `filter-info.js` | Configuração compartilhada e resumo dos filtros. |
| `extension/content.js`, `cosmetic.css` | Ocultação de anúncios, controles do player e ajustes de avisos. |
| `extension/youtube-main.js`, `youtube-bridge.js` | Filtro no ambiente da página e comunicação de preferências. |
| `extension/popup.*` | Interface do painel. |
| `extension/rules/`, `filters/` | Regras locais, catálogo, snapshot e atribuição. |
| `extension/icons/` | Ícones da extensão. |
| `extension/scripts/`, `tests/` | Build e testes automatizados. |
| `packages/` | ZIPs instaláveis para cada navegador. |

## Desenvolvimento

Node 20+ para executar os testes e gerar pacotes. O código de funcionamento não depende de pacotes npm externos.

```sh
npm test
npm run build:chromium
npm run build:firefox
```

Os builds ficam em `dist/chromium` e `dist/firefox`. Selecione a pasta correspondente para carregar a extensão no navegador. As saídas e `node_modules` ficam fora do Git.

Comandos equivalentes:

```sh
node extension/scripts/test.cjs
node extension/scripts/build.cjs chromium dist/chromium
node extension/scripts/build.cjs firefox dist/firefox
```

Para revisar filtros, edite o catálogo ou snapshot, preserve a atribuição e licença, gere as regras novamente e execute os testes. Veja [origem dos filtros](extension/filters/LEIA-ME.md).

## Validação

42 testes simulados passaram na revisão 0.3.1. Também foram verificadas a sintaxe, a estrutura dos manifestos, os caminhos e a integridade dos ZIPs. Os testes cobrem preferências, pausa, iframes, restauração do áudio, filtragem e preservação de dados do player, diagnóstico e geração dos dois builds.

Instalação real em Chromium/Firefox, aparência do painel, reprodução no YouTube real e nova pontuação em testes de bloqueio ainda precisam de confirmação. Uma porcentagem de benchmark não representa remoção de todos os anúncios.

O teste adicional de Chromium com páginas simuladas exige Playwright e seu navegador:

```sh
npm install --no-save playwright
npx playwright install chromium
node extension/tests/browser.e2e.cjs
```

Esse teste adicional está preparado e não foi executado no ambiente da revisão. Para informar um problema, inclua navegador/versão, tipo de anúncio e o diagnóstico exportado pelo painel, após conferir seu conteúdo.

## Licença

O projeto está sob a [licença MIT](LICENSE). O snapshot de contribuições do Steven Black também usa MIT e mantém sua [licença e atribuição próprias](extension/filters/LICENSE-StevenBlack.txt).
