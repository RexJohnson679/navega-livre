# Validação — Navega Livre 0.7.1

Base funcional: 0.7.0 local, com o mesmo motor/listas de anúncios da 0.6.2. A versão 0.7.1 corrige a integração de Mais foco antes da sincronização pública.

## Defeitos reproduzidos e correção

A implementação 0.7.0 salvava preferências, mas dependia de o content script já ter sido carregado na página. A atualização da extensão não garantia sua aplicação às abas previamente abertas. Usava também style inline; o código exato da 0.7.0 foi reproduzido em Firefox real sob uma política de estilos restrita: a tag era criada, mas os comentários continuavam visíveis.

O controlador novo é autocontido. O serviço salva a preferência e aplica o script e a folha de estilo empacotada nas abas de YouTube existentes. O CSS é declarativo nas páginas novas e usa scripting.insertCSS quando ausente em uma página já aberta. Um marcador de versão evita reinserções. Estado ativo, carregamento do CSS e erros aparecem no painel. Falha de aplicação não apaga a preferência.

Foram acrescentados seletores para componentes recentes de Shorts, comentários em painel/chat e relacionados, incluindo variações móveis. As marcações são nomes de componentes, sem depender de texto traduzido. O teste público de HTML inicial não foi suficiente para confirmar todas as variações da interface ao vivo, portanto os cenários de DOM controlados e os testes instalados continuam essenciais.

## Testes locais

127 testes locais passaram. O serviço foi exercitado com os namespaces Chromium e Firefox, incluindo a diferença de caixa de CSSOrigin dos navegadores, aplicação em abas existentes, não duplicação do CSS, rejeição de mensagens de páginas e preservação da opção quando a injeção falha.

Em Firefox 153 real, focus-application.firefox.e2e.cjs executou o background.js e focus.js reais, com adaptadores locais das primitivas de browser API. Duas abas inicialmente sem o controlador receberam o foco, inclusive uma com o legado 0.7.0. Sob CSP de estilos restrita, as três opções ocultaram componentes clássicos/recentes/móveis, preservaram conteúdo, vídeo e navegação normais e restauraram os elementos ao desligar. Cada aba recebeu o CSS uma vez; reinjeções não multiplicaram ouvintes. Pausa por hostname exato foi respeitada.

A interface renovada foi exercitada novamente em Firefox real com APIs simuladas. Esses cenários não instalam toda a extensão nem comprovam DNR/isolamento reais. O CI possui cenários separados com instalação real nos dois navegadores, agora incluindo os controles Mais foco e uma aba Firefox aberta antes de instalar o pacote. O resultado de CI deve ser consultado no commit publicado; não é apresentado como resultado local.

## Preservação e limites

As regras, listas, CSS cosmético, políticas publicitárias e motor de reparo continuam iguais aos da base 0.6.2. Nos scripts MAIN do YouTube e pop-ups só mudou a versão. Nenhuma permissão foi adicionada. Não foi feita nova medição do Turtlecute, de RAM total ou de redução de CPU.

O foco não usa varredura periódica ou MutationObserver. Mantém três atributos e um controlador por aba, usa uma folha de estilo empacotada e reage a preferências e navegação. A aplicação explícita limita-se a 64 abas por ação e informa quando excede esse limite. Não há garantia para todos os layouts futuros do YouTube.

Os pacotes e o código público não incluem o auxiliar privado, imagens do usuário, relatórios recebidos ou downloads de páginas usados na investigação. Os logs publicados são de fixtures neutras. Músicas permanecem fora do escopo. Pacotes sem assinatura de loja; publicação em Releases condicionada aos testes do workflow.

## Reproduzir

```sh
npm test
npm run build:chromium
npm run build:firefox
npm run verify:builds
python3 .github/scripts/check_packages.py
node extension/tests/renewal.firefox.e2e.cjs
node extension/tests/focus-application.firefox.e2e.cjs
node extension/tests/native-dialog.firefox.e2e.cjs
```

Os três últimos comandos exigem Playwright e Firefox no ambiente de QA. NAVEGA_QA_MODULES indica módulos alternativos. NAVEGA_FOCUS_BASELINE pode apontar para focus.js da 0.7.0 para o controle negativo de CSP. O processo de teste local usou MOZ_DISABLE_CONTENT_SANDBOX=1; isso não é uma configuração do pacote distribuído.
