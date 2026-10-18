# Navega Livre 0.7.1

Painel renovado, central de preferências, limpeza manual de links e foco opcional no YouTube. O motor e as listas de anúncios da 0.6.2 foram mantidos; não foram adicionadas permissões. A parte de músicas não integra esta versão.

## Atualizar

Guarde uma cópia da pasta anterior. Substitua os arquivos na mesma pasta já carregada e recarregue a extensão na página de extensões do navegador. Depois recarregue as páginas abertas. Isso ajuda a conservar a identidade e suas preferências. Deixe apenas uma versão principal carregada.

## Instalar do zero

Chrome/Brave/Edge: extraia o pacote do Chromium, ative o modo de desenvolvedor na página de extensões e escolha Carregar sem compactação, selecionando a pasta com manifest.json.

Firefox para computador: extraia o pacote do Firefox, abra about:debugging#/runtime/this-firefox, clique em Carregar extensão temporária e selecione manifest.json. Esta instalação acaba ao reiniciar. Distribuição permanente exige assinatura da Mozilla. Este pacote não está assinado.

## Funções novas

- Cabeçalho: botão de tema e botão para abrir a central.
- ↻: atualizar os contadores da página; não há consultas periódicas do painel.
- YouTube / Mais foco: ocultar Shorts dos feeds, comentários/chat ou vídeos relacionados. Tudo começa desligado. Desligar restaura o layout. A correção 0.7.1 aplica as opções em abas já abertas e informa falhas no painel.
- Ferramentas: prévia de limpeza de um link e cópia manual. Links assinados reconhecidos são preservados.
- Central: pesquisar/remover preferências de sites e exportar/importar backup local, com revisão antes de aplicar.

Backups incluem domínios salvos; não incluem cookies, senhas, histórico, links usados na ferramenta ou conteúdo de páginas. Leitura limitada a 512 KB. Não são enviados a nenhum servidor.

127 testes locais passaram; interface e foco foram exercitados em Firefox 153 real com APIs simuladas. O motor de reparo passou em DOM real. A instalação completa dos dois pacotes continua pendente de validação. Não foi refeita a medição de eficácia do bloqueador ou RAM total.

Consulte PRIVACIDADE.md. Licenças das listas e snapshots estão em filters/. O auxiliar privado e seus relatórios não acompanham o pacote.
