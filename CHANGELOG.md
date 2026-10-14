# Histórico de versões

Os lançamentos antigos foram reconstruídos dos pacotes preservados e publicados retroativamente. As datas do GitHub correspondem a essa publicação; os commits de arquivamento não representam as datas originais do desenvolvimento.

| Versão | Pacotes preservados | Mudança principal |
| --- | --- | --- |
| [0.3.1](https://github.com/RexJohnson679/navega-livre/releases/tag/v0.3.1) | Chromium e Firefox | Correção da API do registro do filtro do YouTube e detecção de abas antigas. |
| [0.3.0](https://github.com/RexJohnson679/navega-livre/releases/tag/v0.3.0) | Chromium e Firefox | Listas ampliadas, bloqueio de rede no Firefox, painel e controles revisados. |
| [0.2.0](https://github.com/RexJohnson679/navega-livre/releases/tag/v0.2.0) | Chromium | Filtro XHR e diagnóstico do player. |
| [0.1.0](https://github.com/RexJohnson679/navega-livre/releases/tag/v0.1.0) | Chromium e Firefox | Primeiros pacotes preservados. |

As versões 0.1.0 a 0.3.0 tinham a chamada de atualização incorreta corrigida na 0.3.1. O Firefox 0.1.0 também não declarava a lista de bloqueio de rede. Os arquivos antigos ficam disponíveis para consulta; prefira a versão recomendada no painel de Releases.

Cada tag histórico contém os scripts e manifestos extraídos dos ZIPs daquele estágio, em pastas por navegador. Metadados de publicação foram adicionados durante o arquivamento. Os ZIPs anexados são cópias exatas dos arquivos preservados, com SHA-256 para conferência.

O publicador está em `.github/scripts/publish_history.py`. O catálogo declara arquivos, checksums, notas e commits de origem. Ele publica rascunhos somente após conferir os anexos e não substitui anexos existentes. O workflow roda na branch main com a permissão `contents: write`; não modifica o comportamento da extensão instalada.
