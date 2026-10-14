# Privacidade — Navega Livre 0.4.0

O funcionamento é local. A extensão não possui servidor, telemetria, anúncios próprios, pagamentos ou código remoto. Filtros e código executável estão no pacote; não há atualização remota automática de listas.

As preferências usam `storage.local` no navegador: sete opções booleanas e listas de domínios pausados ou com ajuste de aviso ativado. Não há histórico de páginas, registro de requisições bloqueadas nem cópia de respostas armazenados pela extensão.

Os scripts leem domínio e elementos da página para reconhecer espaços de anúncios, player e avisos explícitos de bloqueador. Nas molduras, o serviço informa o hostname da página principal para respeitar sua pausa. O ajuste de avisos é opcional por domínio e não modifica login, assinatura ou autorização do servidor.

No YouTube, o script no ambiente `MAIN` observa objetos iniciais e respostas de endpoints específicos. Remove somente campos publicitários conhecidos, localmente. Requisições seguem para o serviço normalmente; as respostas não são enviadas a terceiros pela extensão. Campos de vídeo, conta, URLs e assinaturas permanecem. O site pode interferir no script porque ele compartilha o ambiente da página.

O script de preferências comunica apenas `enabled: true/false` como texto JSON à página. Essa comunicação não expõe APIs da extensão, listas de outros domínios, cookies ou tokens.

A proteção de pop-ups examina o destino de uma abertura e o link/botão do gesto atual. Esses dados não são enviados, exportados nem guardados em histórico. O gesto é descartado ao terminar o evento. A camada nativa mantém, por até 15 segundos, IDs de uma aba de origem e de uma aba recém-criada; mantém também contadores em memória, com limite de 200 entradas. URLs completas não são armazenadas nesses mapas. Fechar a aba remove seus registros.

Somente diálogos com um pedido de instalar/baixar outro bloqueador para desbloquear ou continuar são suprimidos. Confirmações comuns, login e paywalls não são alterados.

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

O download acontece somente quando solicitado no painel. Inclui versão, família de navegador, origem do site, opções dessa página, contadores locais de interface e pop-ups, estado das listas, versão esperada e versão do filtro do player. Não inclui caminho, parâmetros ou fragmento da URL, conteúdo de respostas, HTML, cookies ou tokens. Erros de APIs podem aparecer como mensagens curtas. Revise o arquivo antes de compartilhá-lo.

Os contadores representam elementos ocultados, cliques no botão de pular, respostas examinadas e campos publicitários removidos. Não representam número de requisições bloqueadas nem de anúncios em vídeo eliminados.

Pause a proteção e recarregue para desfazer alterações na página. Em instalações temporárias do Firefox, preferências locais podem persistir entre recargas, remoção e reinício. Não há dados desta extensão em um servidor próprio.
