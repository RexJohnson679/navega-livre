# Navega Livre 0.3.1

Extensão experimental para computadores. Os pacotes Chromium e Firefox usam o mesmo código de bloqueio e controles, com manifestos próprios. Inclui código-fonte, filtros, licença da lista externa e testes. Não precisa instalar Node para usar a extensão.

## Correção 0.3.1

Corrigido o erro `updateRegisteredContentScripts is not a function`: a API correta é `scripting.updateContentScripts`. O registro agora é atualizado apenas se a configuração mudou; há alternativa por remoção/registro quando o método de atualização não existe. Novos testes usam somente os nomes documentados de APIs e cobrem atualizações em Chromium e Firefox. O painel reconhece filtros antigos em abas abertas e mostra a versão exata da extensão. Feche todas as abas antigas do YouTube e abra uma nova após instalar esta correção. O fim dos anúncios em vídeo ainda depende de validação real.

## O que foi melhorado

- Firefox passou a declarar a permissão e as listas de bloqueio de rede. O pacote anterior não fazia esse bloqueio.
- 3.059 domínios distintos nas duas listas: 2.999 na lista principal de publicidade/conexões indesejadas e 60 na lista adicional de rastreadores. As listas incluem subdomínios dos destinos listados, regras para scripts publicitários comuns e uma seleção do arquivo de contribuições do Steven Black. Não são a coleção completa EasyList ou uBlock Origin.
- Filtro do YouTube atualizado nos dois navegadores: dados iniciais, JSON embutido na configuração antiga do player e respostas `fetch`/`XMLHttpRequest` de endpoints específicos. Remove apenas `playerAds`, `adPlacements` e `adSlots`.
- Preferências do YouTube enviadas como texto JSON entre os ambientes de scripts, para evitar o problema de acesso a objetos entre compartimentos do Firefox.
- Filtro do player registrado em `document_start`; preferências também lidas cedo. Abra uma nova aba após atualizar a extensão.
- Estilos de ocultação empacotados no manifesto. Novos seletores para espaços de anúncios, com controle para restaurá-los.
- Pausa por domínio respeitada nos iframes; verificação de hostname para não ocultar um iframe só por conter o nome de uma rede no caminho ou nos parâmetros.
- Sites comuns usam observação de mudanças no DOM, sem varredura periódica. Verificação periódica continua apenas no YouTube ou em sites com ajuste de aviso ativado.
- Painel dividido em Proteção, YouTube e Avisos, com navegação por teclado, estado real das listas e diagnóstico local. Exportação informa somente a origem do site, sem caminho, parâmetros ou fragmento.

## Compatibilidade declarada

| Pacote | Navegadores | Mínimo declarado |
| --- | --- | --- |
| Chromium | Chrome; Edge e Brave compatíveis com esta API Chromium | Chrome/Chromium 120 |
| Firefox | Firefox para computador | Firefox 128 |

Firefox 128 introduziu o ambiente `MAIN` usado pelo filtro do player. Estas versões mínimas são requisitos das APIs; não representam certificação nem testes reais executados em cada navegador. Brave e outros bloqueadores podem alterar o resultado de testes quando usados juntos.

## Atualizar ou instalar

Extraia o ZIP em uma pasta permanente. Use apenas uma cópia do Navega Livre por navegador. Atualize a pasta já instalada e recarregue a extensão, ou remova a cópia anterior e carregue a pasta nova. Se mudar de pasta no Chromium, a instalação pode ter outro identificador e suas preferências podem não migrar.

### Firefox

1. Extraia **o pacote Firefox**.
2. Abra `about:debugging#/runtime/this-firefox`.
3. Clique em **Carregar extensão temporária** / **Load Temporary Add-on**.
4. Selecione `navega-livre/manifest.json` dentro da pasta extraída.
5. Se já tinha uma cópia temporária, remova-a antes de carregar a nova, ou atualize sua pasta e use **Recarregar** nessa tela.
6. Confira que a extensão tem acesso aos sites em que será usada.
7. Feche as abas antigas do YouTube e abra uma nova aba. No painel, confira **Rede carregada** e **Filtro carregado**.

Esse carregamento é temporário: a extensão é removida ao reiniciar o Firefox. Preferências de uma instalação temporária podem persistir. O ZIP não é uma extensão assinada para instalação permanente; essa etapa exige assinatura da Mozilla.

### Chrome, Edge e Brave

1. Extraia **o pacote Chromium**.
2. Abra `chrome://extensions`, `edge://extensions` ou `brave://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** / **Load unpacked**.
5. Selecione a pasta `navega-livre` que contém `manifest.json`.
6. Para atualizar na mesma pasta, substitua os arquivos e clique em **Recarregar** na extensão.
7. Recarregue os sites abertos. Feche as abas antigas do YouTube e abra uma nova.

## Usar os controles

**Proteção:** bloqueio geral, lista adicional de rastreadores e ocultação de espaços. Se um elemento legítimo sumir, desligue **Ocultar espaços de anúncios**. Se uma função do site falhar, teste desligar a lista de rastreadores ou pause a proteção naquele domínio e recarregue. Desligar rastreadores desativa a lista adicional; domínios mistos de publicidade/rastreamento podem continuar na lista principal.

**YouTube:** ajuste experimental, clique no botão de pular quando disponível e silenciamento opcional. O áudio anterior é restaurado após o anúncio ou a pausa da extensão. O filtro não muda duração, velocidade, URLs, assinaturas nem autorização dos vídeos. Alguns formatos ou anúncios inseridos junto ao vídeo podem permanecer. A aba precisa ser recarregada para desfazer alterações que já foram feitas nos dados do player.

**Avisos:** tentativa local e opcional de ocultar camadas com mensagens explícitas sobre bloqueador, preservando login e assinaturas. Há um adaptador para o aviso publicitário de `tavvkkj.xyz`, baseado no código analisado anteriormente; mudanças no site podem invalidá-lo. Ocultar um aviso não faz o servidor entregar conteúdo que ele não enviou. Não existe liberação universal de sites.

**Diagnóstico:** exporta estados e contadores, somente quando você clica. Se aparecerem anúncios, exporte o arquivo e descreva se eram de vídeo, banners ou avisos de bloqueador. Revise o relatório antes de compartilhá-lo.

## Testes de bloqueio

O site [adblock.turtlecute.org](https://adblock.turtlecute.org/) verifica destinos, scripts e elementos específicos. Sua porcentagem ajuda a encontrar lacunas; não prova remoção de todos os anúncios. Não há regras para falsificar o teste ou substituir seu resultado.

Para comparar versões, mantenha o mesmo navegador e condições, abra uma aba nova depois da atualização e registre quais verificações falharam. Outros bloqueadores e proteções nativas do navegador podem interferir. Para isolar a contribuição desta extensão, use um perfil separado de teste. Você pode continuar usando seus outros bloqueadores no perfil habitual.

Não foi medida uma nova porcentagem nesta revisão. O navegador disponível bloqueou acesso à instalação de extensões e o ambiente local não disponibilizou binários completos de Chromium/Firefox. Reprodução real no YouTube, compatibilidade com sites reais e aparência do painel ainda precisam de validação nos navegadores.

## Desenvolvimento

Node 20+ para os testes simulados e geração dos pacotes, sem dependências de funcionamento:

```sh
node scripts/test.cjs
node scripts/build.cjs
node scripts/build.cjs chromium
node scripts/build.cjs firefox
```

Os dois últimos comandos geram `dist/chromium` e `dist/firefox`. Arquivos executáveis e filtros são locais. Atualizações da lista externa exigem revisar o snapshot, reconstruir e entregar um pacote novo; a extensão não baixa código nem listas em segundo plano.

`tests/browser.e2e.cjs` é um teste adicional de Chromium com páginas simuladas e regras de rede reais. Exige Playwright e seu Chromium em uma máquina de desenvolvimento:

```sh
npm install --no-save playwright
npx playwright install chromium
node tests/browser.e2e.cjs
```

Esse teste adicional foi preparado, mas não executado nesta revisão. As 42 verificações simuladas passaram; veja `RELATORIO.md` para o alcance da validação.

Fontes técnicas: [Firefox 128](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/128), [RegisteredContentScript](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/RegisteredContentScript), [instalação temporária no Firefox](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/), [instalação local no Chrome](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

Veja `PRIVACIDADE.md` e `filters/LEIA-ME.md`.
