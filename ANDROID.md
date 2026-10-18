# Firefox para Android — Navega Livre 0.8.0

O mesmo ZIP de Firefox é usado para computador e Android. O manifesto inclui gecko.id, background.scripts e browser_specific_settings.gecko_android.strict_min_version 128.0. Não usa service_worker no pacote Mozilla. A versão mínima considera scripting MAIN e declarativeNetRequest.domainType, disponíveis a partir de 128 nos dados MDN; compatibilidade declarada não significa teste em todas as versões e aparelhos.

## Enviar à Mozilla

1. Baixe navega-livre-firefox-v0.8.0.zip, sem extrair para o envio. O manifest.json fica na raiz do ZIP.
2. Envie esse arquivo ao AMO. Não envie o arquivo com chromium no nome: ele usa o manifesto de outro navegador e causa os erros de service_worker e ID ausente.
3. Escolha Firefox e Firefox para Android. Confira os resultados do lint e do teste Android do commit antes de enviar.
4. Se solicitado o código-fonte, envie navega-livre-codigo-fonte-v0.8.0.zip. BUILD-FIREFOX.md contém os comandos offline para reproduzir o pacote.
5. Conclua a revisão/assinatura na sua conta Mozilla. Um ZIP renomeado para XPI continua sem assinatura.

## Instalar no celular

Para usuários, a instalação mais simples é pela página da extensão publicada em addons.mozilla.org no Firefox para Android. Um pacote assinado e distribuído por arquivo também pode ser instalado: baixe o XPI assinado; abra Configurações > Sobre o Firefox; toque cinco vezes no logotipo; volte às configurações e escolha Instalar extensão do arquivo. Selecione o XPI assinado e confirme a instalação.

O ZIP do GitHub é para envio/desenvolvimento, não um instalador Android permanente. Para desenvolvimento com aparelho ou emulador isolado, use web-ext run -t firefox-android --adb-device ID --firefox-apk org.mozilla.firefox, com depuração remota via USB habilitada.

## Uso e limites

Abra a extensão pelo menu de extensões do Firefox. O foco visual, o bloqueio e o reparo atuam nas páginas deste navegador, incluindo a versão web do YouTube. Não modificam aplicativos instalados no Android. Os controles podem ser usados com toque. Em um aviso, Tentar liberar aviso salva o acompanhamento local e pode fechar o painel para permitir que a página volte ao primeiro plano.

A detecção conserva os limites de processamento e pausa em páginas ocultas. O foco não tem temporizador ou observador de DOM. Não foram acrescentadas permissões, telemetria ou listas. RAM e bateria em aparelhos reais não foram medidas. A API tabs.query do Firefox Android pode expor apenas parte das abas; a aba indicada tem prioridade, e abrir o painel ou recarregar aplica o foco às restantes.

## Fontes oficiais

- https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/
- https://extensionworkshop.com/documentation/publish/install-self-distributed/
- https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/scripting.json
- https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/declarativeNetRequest.json
- https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/tabs.json
