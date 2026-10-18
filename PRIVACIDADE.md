# Privacidade — Navega Livre 0.7.1

O funcionamento é local. A extensão não possui servidor, telemetria, anúncios próprios, pagamentos ou código remoto. Filtros e código executável estão no pacote; não há atualização remota automática de listas.

As preferências usam `storage.local` no navegador: sete opções de proteção, listas de domínios pausados ou com reparo de aviso ativado e um registro separado de tema e três opções de foco no YouTube. Não há histórico de páginas, registro de requisições bloqueadas nem cópia de respostas armazenados pela extensão.

Os scripts leem domínio e elementos da página para reconhecer espaços de anúncios, player e avisos explícitos de bloqueador. Nas molduras, o serviço informa o hostname da página principal para respeitar sua pausa. O ajuste de avisos é opcional por domínio e não modifica login, assinatura ou autorização do servidor.

No YouTube, o script no ambiente `MAIN` observa objetos iniciais e respostas de endpoints específicos. Remove somente campos publicitários conhecidos, localmente. Requisições seguem para o serviço normalmente; as respostas não são enviadas a terceiros pela extensão. Campos de vídeo, conta, URLs e assinaturas permanecem. O site pode interferir no script porque ele compartilha o ambiente da página.

O script de preferências comunica apenas `enabled: true/false` como texto JSON à página. Essa comunicação não expõe APIs da extensão, listas de outros domínios, cookies ou tokens.

A proteção de pop-ups examina o destino de uma abertura e o link/botão do gesto atual. Esses dados não são enviados, exportados nem guardados em histórico. O gesto fica apenas na memória da página e só autoriza aberturas por 1,2 segundo; a próxima interação o substitui e encerrar a página libera seus dados. A camada nativa mantém, por até 15 segundos, IDs de uma aba de origem e de uma aba recém-criada; mantém também contadores em memória, com limite de 200 entradas. URLs completas não são armazenadas nesses mapas. Fechar a aba remove seus registros.

Diálogos visuais flutuantes com selo de publicidade e chamada de download também podem ser ocultados, preservando downloads comuns. O reparo opcional também reconhece avisos em domínios sem adaptador, por texto e estrutura da página. Pode usar um controle explícito de fechar, fechar um diálogo nativo, ocultar o contêiner e seu fundo relacionado e restaurar a rolagem, atributos inert/aria-hidden, bloqueio de cliques e desfoque do conteúdo ao fundo, inclusive em contêineres aninhados. Textos, seletores aprendidos e HTML não são guardados nem enviados. A observação só é ativada nos domínios escolhidos, inclusive em suas molduras, e pausa o processamento em abas ocultas. As referências temporárias a elementos têm limites e são liberadas ao desligar; o fechamento nativo de um aviso pode exigir recarregar para desfazer. Somente diálogos JavaScript com um pedido de instalar/baixar outro bloqueador para desbloquear ou continuar são suprimidos. Confirmações comuns, login e paywalls não são alterados.

## Ferramentas opcionais da 0.7

O foco do YouTube carrega uma folha de estilo incluída no pacote, declarativamente ou pela API do navegador, e usa três atributos de ativação para ocultar Shorts do feed, comentários/chat e/ou relacionados, conforme as escolhas. Todas as opções começam desligadas. Não examina conteúdo de mensagens, não cria observadores de DOM e não faz requisições ou consultas periódicas. Respeita a pausa geral ou por hostname; retirar a opção remove os atributos de ativação, deixando o estilo inativo. Ao mudar as opções, o serviço consulta as abas abertas do YouTube e tenta aplicar em até 64 delas, sem guardar histórico ou URLs. IDs e endereços dessas abas são usados apenas durante a ação; o painel mostra se o controlador e o CSS carregaram. O controlador não depende dos demais scripts de conteúdo e não duplica ouvintes ao ser reinjetado.

A limpeza de links trata somente o texto que você cola ou escolhe preencher da aba atual. Pode remover parâmetros conhecidos de rastreamento e preserva links com assinatura ou credencial reconhecida. O texto e os resultados ficam apenas na memória do painel, não vão para diagnóstico, backup ou storage.local e não são enviados pela extensão. A cópia para a área de transferência ocorre somente quando você clica em Copiar resultado; se o navegador recusar, o resultado fica selecionado para cópia manual. A ferramenta não segue redirecionamentos nem abre o link.

A central permite exportar e importar um backup com opções, listas de domínios, tema e foco. O arquivo pode revelar os domínios escolhidos. Não inclui cookies, senhas, histórico, textos de páginas, contadores ou links usados na ferramenta. A importação aceita até 512 KB, valida a estrutura/tipos e permite revisar as opções antes de aplicar. Não importa código nem filtros. Restaurar o padrão limpa as preferências e listas locais após confirmação.

O painel consulta diagnósticos ao abrir ou em ações/eventos de navegação e preferências. Não faz mais consultas periódicas a cada dois segundos. Não há recurso de música nesta versão.

## Permissões

| Permissão | Uso |
| --- | --- |
| `declarativeNetRequest` | Bloquear publicidade e conexões indesejadas pelas listas locais; aplicar exceções por domínio. |
| `storage` | Guardar preferências locais. |
| `scripting` | Registrar os filtros do player e de pop-ups no início da página, aplicar o adaptador específico e verificar seu estado. |
| `webNavigation` | Identificar uma aba recém-aberta por uma página e acompanhar um redirecionamento publicitário curto. |
| `activeTab` | Consultar e agir na aba escolhida no painel. |
| HTTP/HTTPS em todos os sites | Executar ajustes nas páginas e iframes visitados. Páginas internas do navegador têm restrições próprias. |

Não há leitura deliberada de senhas, cookies, tokens, histórico ou formulários. O acesso amplo às páginas é necessário para a função da extensão; todo o código está incluído para revisão.

## Exportação de diagnóstico

O download acontece somente quando solicitado no painel. Inclui versão, família de navegador, origem do site, opções dessa página, contadores locais de interface e pop-ups, estado e contadores numéricos da análise de avisos, estado das listas, versão esperada e versão do filtro do player. Não inclui caminho, parâmetros ou fragmento da URL, conteúdo de respostas, HTML, cookies ou tokens. Erros de APIs podem aparecer como mensagens curtas. Revise o arquivo antes de compartilhá-lo.

Os contadores representam elementos ocultados, cliques no botão de pular, respostas examinadas e campos publicitários removidos. Não representam número de requisições bloqueadas nem de anúncios em vídeo eliminados.

Pause a proteção e recarregue para desfazer alterações na página. Em instalações temporárias do Firefox, preferências locais podem persistir entre recargas, remoção e reinício. Não há dados desta extensão em um servidor próprio.
