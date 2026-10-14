# Navega Livre

Extensão para navegadores focada em redução local de anúncios, ajustes no YouTube e reparo de avisos de adblock.

**Versão 0.4.0 · Manifest V3 · Licença MIT**

## O que mudou na 0.4.0

- Proteção de pop-ups no início da página: bloqueia aberturas automáticas, destinos publicitários conhecidos e uma aba extra que não corresponde ao link clicado.
- Bloqueio de links invisíveis que cobrem a tela e de diálogos falsos exigindo instalar outro bloqueador.
- Fechamento de abas publicitárias originadas por uma página protegida, incluindo uma aba inicialmente vazia que redireciona logo depois. Abas existentes e endereços digitados por você não são alvos desse mecanismo.
- Filtros para slots PubADX, A-Ads, anúncios flutuantes, imagens e frames publicitários. As partes úteis da página e controles de fechar comuns são preservados.
- Inclusão das redes observadas `pubadx.one`, `diveinthebluesky.biz`, `pa.diffgremio.com` e `acscdn.com`. O bloqueio de rede e os filtros de elementos usam o mesmo catálogo local.
- Controle separado para pop-ups, contadores locais e pausa por site. São 3.063 domínios nas listas: 3.003 de publicidade/conexões indesejadas e 60 de rastreamento.

Os ajustes do player e o reparo opcional de avisos continuam presentes. Os filtros não alteram login, assinatura ou permissões de acesso concedidas pelo servidor.

## Instalar ou atualizar

Baixe o pacote do seu navegador em [Releases](https://github.com/RexJohnson679/navega-livre/releases/latest). O [histórico](CHANGELOG.md) mantém os pacotes anteriores e suas limitações.

| Pacote | Navegadores | Mínimo |
| --- | --- | --- |
| [Chromium 0.4.0](packages/history/v0.4.0/navega-livre-chromium-v0.4.0.zip) | Chrome, Edge e Brave compatíveis com as APIs usadas | Chromium 120 |
| [Firefox 0.4.0](packages/history/v0.4.0/navega-livre-firefox-v0.4.0.zip) | Firefox para computador | Firefox 128 |

**Chrome, Edge e Brave:** extraia o ZIP, abra a página de extensões, ative o modo de desenvolvedor e escolha “Carregar sem compactação”. Selecione a pasta `navega-livre`, onde está `manifest.json`. Para atualizar, substitua os arquivos da pasta instalada e recarregue a extensão. Não mantenha duas versões carregadas.

**Firefox:** extraia o pacote Firefox. Abra `about:debugging#/runtime/this-firefox`, escolha “Carregar extensão temporária” e selecione `manifest.json`. A instalação temporária termina ao reiniciar o navegador; distribuição permanente exige assinatura pela Mozilla.

A 0.4.0 declara `webNavigation` para identificar a origem de abas publicitárias. Confira as permissões da atualização. Feche as abas antigas dos sites e abra novas, ou recarregue-as, para carregar os scripts novos.

## Controles

- **Ativar proteção neste site:** pausa rede, anúncios visuais e pop-ups para aquele hostname, também nos iframes da página.
- **Bloquear pop-ups e abas indesejadas:** controla a proteção de abertura de janelas, links publicitários e diálogos falsos. Desligue temporariamente se um botão legítimo de um site depender de uma abertura que foi bloqueada.
- **Ocultar espaços de anúncios:** controla apenas os filtros visuais. Ao desligar, os elementos ocultados voltam.
- **YouTube:** filtros de dados do player, ocultação de espaços, botão de pular quando disponível e opção de silenciar anúncios. O painel detecta abas que ainda têm o filtro antigo.
- **Tentar liberar aviso:** ajuste opcional de avisos de bloqueador nos sites compatíveis.

Nenhum bloqueador garante eliminar todos os formatos de publicidade. Scripts, domínios e layouts podem mudar; permissões, outras extensões e a versão do navegador também influenciam o resultado. O bloqueio não considera todo link externo um anúncio: links escolhidos e botões explícitos de autenticação, compartilhamento e impressão são preservados.

## Privacidade e filtros

Preferências, filtros e processamento ficam no navegador. Sem telemetria, servidor próprio, anúncios próprios ou código remoto. O diagnóstico exportado pelo painel contém origem do site e contadores; não inclui caminho da página, parâmetros, cookies ou respostas do player.

Veja [PRIVACIDADE.md](extension/PRIVACIDADE.md), [origem dos filtros](extension/filters/LEIA-ME.md) e [relatório de validação](extension/RELATORIO.md). O snapshot de contribuições de StevenBlack/hosts conserva sua licença. As listas empacotadas não são a coleção completa do uBlock Origin ou EasyList.

## Desenvolvimento e validação

Requer Node.js 20 ou mais recente. A extensão não depende de pacotes externos em tempo de execução.

```sh
npm test
npm run build:chromium
npm run build:firefox
python3 .github/scripts/check_packages.py
```

62 testes locais cobrem preferências, pausa, rede, registro de scripts, player, iframes, cosméticos, pop-ups, diálogos e diagnóstico. O fluxo do GitHub Actions exige testes com a extensão instalada em Chromium e Firefox antes de publicar um lançamento. As páginas desses testes são controladas e simulam sites de leitura, notícias e vídeo, com anúncios de redes e cliques de tipos diferentes; não são uma medição de todos os sites reais nem uma pontuação em benchmarks.

Os testes de navegador usam Playwright 1.64.0 e Selenium 4.51.0 em perfis descartáveis. Não acessam contas nem instalam a extensão no navegador de quem usa o projeto. Resultados e falhas ficam em [Actions](https://github.com/RexJohnson679/navega-livre/actions).

O catálogo de lançamentos em `.github/release-history.json` registra notas, commits e checksums. ZIPs antigos são preservados; a publicação da versão atual depende da validação dos arquivos e dos navegadores.
