# Privacidade — Navega Livre 0.3.1

O funcionamento é local. A extensão não possui servidor, telemetria, anúncios próprios, pagamentos ou código remoto. Filtros e código executável estão no pacote; não há atualização remota automática de listas.

As preferências usam `storage.local` no navegador: seis opções booleanas e listas de domínios pausados ou com ajuste de aviso ativado. Não há histórico de páginas, registro de requisições bloqueadas nem cópia de respostas armazenados pela extensão.

Os scripts leem domínio e elementos da página para reconhecer espaços de anúncios, player e avisos explícitos de bloqueador. Nas molduras, o serviço informa o hostname da página principal para respeitar sua pausa. O ajuste de avisos é opcional por domínio e não modifica login, assinatura ou autorização do servidor.

No YouTube, o script no ambiente `MAIN` observa objetos iniciais e respostas de endpoints específicos. Remove somente campos publicitários conhecidos, localmente. Requisições seguem para o serviço normalmente; as respostas não são enviadas a terceiros pela extensão. Campos de vídeo, conta, URLs e assinaturas permanecem. O site pode interferir no script porque ele compartilha o ambiente da página.

O script de preferências comunica apenas `enabled: true/false` como texto JSON à página. Essa comunicação não expõe APIs da extensão, listas de outros domínios, cookies ou tokens.

## Permissões

| Permissão | Uso |
| --- | --- |
| `declarativeNetRequest` | Bloquear publicidade e conexões indesejadas pelas listas locais; aplicar exceções por domínio. |
| `storage` | Guardar preferências locais. |
| `scripting` | Registrar o filtro do player no início da página, aplicar o adaptador específico e verificar seu estado. |
| `activeTab` | Consultar e agir na aba escolhida no painel. |
| HTTP/HTTPS em todos os sites | Executar ajustes nas páginas e iframes visitados. Páginas internas do navegador têm restrições próprias. |

Não há leitura deliberada de senhas, cookies, tokens, histórico ou formulários. O acesso amplo às páginas é necessário para a função da extensão; todo o código está incluído para revisão.

## Exportação de diagnóstico

O download acontece somente quando solicitado no painel. Inclui versão, família de navegador, origem do site, opções dessa página, contadores locais, estado das listas, versão esperada e versão do filtro do player. Não inclui caminho, parâmetros ou fragmento da URL, conteúdo de respostas, HTML, cookies ou tokens. Erros de APIs podem aparecer como mensagens curtas. Revise o arquivo antes de compartilhá-lo.

Os contadores representam elementos ocultados, cliques no botão de pular, respostas examinadas e campos publicitários removidos. Não representam número de requisições bloqueadas nem de anúncios em vídeo eliminados.

Pause a proteção e recarregue para desfazer alterações na página. Em instalações temporárias do Firefox, preferências locais podem persistir entre recargas, remoção e reinício. Não há dados desta extensão em um servidor próprio.
