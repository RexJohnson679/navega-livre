# Privacidade — Navega Livre 0.1.0

Esta versão funciona localmente. Não possui servidor, telemetria, anúncios próprios, pagamentos ou código remoto.

Ela lê o domínio e os elementos da página para ocultar espaços publicitários e, nos sites ativados pelo usuário, tentar ajustar avisos de bloqueador. No YouTube, procura marcadores de anúncios e botões de pular. As preferências ficam em `chrome.storage.local` neste navegador.

No YouTube, o filtro experimental atua nos dados iniciais do player e nas respostas JSON de endpoints específicos. Remove somente campos publicitários conhecidos, localmente. As requisições continuam indo para o YouTube normalmente; nenhuma resposta é enviada para terceiros. O filtro roda no ambiente da própria página e pode ser interferido pelo site.

Permissões:
- `declarativeNetRequest`: bloquear pedidos para a lista local de redes de publicidade.
- `storage`: guardar suas escolhas por domínio e preferências.
- `scripting`: aplicar o adaptador local de aviso publicitário nos domínios conhecidos.
- `activeTab`: agir na aba escolhida no painel.
- acesso HTTP/HTTPS: executar os ajustes nas páginas visitadas. Não concede acesso às páginas internas do navegador.

Não há leitura deliberada de senhas, cookies, tokens, histórico ou conteúdo de formulários. O acesso amplo às páginas, necessário ao funcionamento, é uma permissão sensível: todo o código-fonte está neste pacote para revisão.

O diagnóstico é baixado somente quando você pede. Ele contém o endereço da página sem parâmetros ou fragmento, preferências desta página e contadores locais. O caminho da página pode revelar o que você está lendo: confira o arquivo antes de compartilhá-lo. Não há envio automático.

Desinstalar a extensão remove suas preferências. Para desfazer ajustes na página, pause a extensão e recarregue a aba.
