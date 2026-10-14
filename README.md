# Navega Livre 0.3.0 — snapshot arquivado

Unificação dos pacotes Chromium e Firefox e ampliação da base de filtros.

### Mudanças

- Bloqueio de rede declarado no Firefox e mínimo Firefox 128 para o ambiente MAIN.
- 3.059 domínios distintos nas listas locais e regras para scripts publicitários comuns.
- Lista adicional de rastreadores, ocultação cosmética independente e pausa respeitada em iframes.
- Filtro do YouTube sincronizado nos dois navegadores e comunicação de preferências em texto JSON.
- Painel com abas, teclado, diagnóstico e menos varreduras periódicas em sites comuns.

### Problema conhecido

Os testes simulados desta versão também reproduziam o nome incorreto `updateRegisteredContentScripts`. Em uso real, o painel mostrou que o método não existia. A correção e os testes de regressão chegaram na 0.3.1. Use a versão atual; esta permanece como registro do desenvolvimento.

Os dois ZIPs originais foram preservados. O código do tag foi reconstruído desses arquivos, com metadados de publicação adicionados durante o arquivamento. Este lançamento está sendo publicado retroativamente.


As pastas `chromium/` e, quando disponível, `firefox/` contêm os arquivos extraídos dos pacotes preservados.
