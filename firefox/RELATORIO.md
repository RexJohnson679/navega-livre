# Revisão 0.3.0 — 14/10/2026

## Problemas encontrados nos pacotes recebidos

O pacote Chromium estava na versão 0.2.0. O Firefox ainda estava em 0.1.0, sem permissão `declarativeNetRequest` e sem declaração da lista de rede, e declarava mínimo 121 apesar do uso de `MAIN`, introduzido no Firefox 128. Os dois tinham apenas 16 domínios na lista de publicidade. O Firefox também tinha o filtro antigo do player, que não tratava `XMLHttpRequest`.

Estas são falhas comprovadas na estrutura do pacote. Não foi possível demonstrar que explicam cada anúncio visto pelo usuário: a reprodução real no YouTube não foi validada nesta revisão.

## Resultado entregue

Dois pacotes 0.3.0, gerados do mesmo código, com fundo próprio para cada navegador. Bloqueio de rede ativado no Firefox, lista principal ampliada, lista adicional de rastreadores, filtros de scripts publicitários, seleção cosmética ampliada, CSS declarado no manifesto e controles independentes.

Filtro do YouTube sincronizado: dados iniciais e antigos, fetch e XHR, ponte de preferências em texto e diagnóstico do carregamento. Pausa de sites considerada em iframes, restauração de elementos/áudio e observação do DOM sem intervalo periódico em sites comuns.

Painel com abas, teclado, dependências entre opções e falhas de rede visíveis. Exportação de diagnóstico limitada à origem, sem caminho ou parâmetros da página.

## Verificação executada

37 testes automatizados passaram, com Node e APIs/DOM simulados:

- configuração, reconhecimento de domínio e exceções sem correspondência com domínios parecidos;
- fila de alterações, permissão de operações e escolha do namespace de APIs Firefox;
- ativação/desativação de listas, registro `MAIN` cedo e estado de falhas;
- mensagens em texto entre ambientes, pausa global e por domínio, inclusive em molduras;
- ocultação/restauração de espaços conhecidos e reconhecimento seletivo de avisos;
- clique apenas em botão de pular disponível e restauração do áudio;
- limpeza de dados iniciais, JSON embutido, fetch, XHR texto/JSON e prefixo XSSI;
- preservação de respostas comuns, requisições falhas/parciais, URLs, assinaturas e dados da conta;
- controles do painel, teclado, consulta do frame principal e exportação sem URL privada;
- simulação de cobertura de redes e scripts, exclusão de navegação principal e preservação de hosts de vídeo/CDNs compartilhados;
- geração determinística de manifestos Chromium/Firefox com arquivos e listas apropriados.

Também foram conferidos sintaxe, domínios das regras, caminhos declarados, arquivos dos ZIPs e integridade dos arquivos compactados. Os testes de regras simulam as condições usadas no projeto; não substituem o motor real do navegador.

## Verificação que continua pendente

O site Turtlecute abriu, mas o navegador deste ambiente rejeitou acesso à instalação de extensões. O ambiente local não possui binários completos de Chromium/Firefox. Assim, não houve instalação real destes pacotes, medição de uma nova porcentagem, teste visual do painel nem reprodução real com anúncios no YouTube.

`tests/browser.e2e.cjs` foi atualizado para testar o pacote Chromium em páginas simuladas com Playwright. Está incluído, mas não foi executado nesta revisão.

Não há garantia de 100% nem regra para falsear o placar de um teste. A lista é uma base inicial ampliada, e formatos do YouTube e detectores por site exigem manutenção. As listas são snapshots locais; não há atualização automática.

## Confirmação nos navegadores

1. Instale apenas a cópia nova do Navega Livre; confira versão 0.3.0.
2. Feche o YouTube antigo, abra uma aba nova e confira os estados de rede e player no painel.
3. Teste um vídeo normal, avanço, troca de vídeo, pausa e áudio. Registre que tipo de anúncio restou.
4. Teste pausa por site e recarga; confirme que conteúdo ocultado volta e que a página continua funcional.
5. Rode Turtlecute com as mesmas condições antes/depois. Para isolar a extensão, use um perfil de teste; registre falhas por categoria.
6. Se persistir uma falha, exporte o diagnóstico local e anote navegador, versão e tipo de anúncio.
