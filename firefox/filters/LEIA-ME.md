# Origem e geração dos filtros

`sources/stevenblack-own.hosts` é um snapshot do arquivo de contribuições do próprio Steven Black, obtido em 14/10/2026:

- fonte: https://raw.githubusercontent.com/StevenBlack/hosts/master/data/StevenBlack/hosts
- repositório: https://github.com/StevenBlack/hosts
- licença: MIT, incluída em `LICENSE-StevenBlack.txt`;
- licença original: https://github.com/StevenBlack/hosts/blob/master/license.txt

O snapshot é uma seleção de contribuições desse arquivo, não o hosts agregado de todos os provedores do repositório. Ele inclui publicidade, rastreamento e outros destinos indesejados. O build conserva entradas IPv4 `0.0.0.0`, normaliza e elimina duplicatas. Preserva raízes de serviços compartilhados e toda a família dos hosts de vídeo/player do YouTube; exceções explícitas constam em `catalog.json`.

`catalog.json` complementa redes publicitárias e rastreadores conhecidos. Regras de domínio usam contexto de terceiros e deixam navegação principal fora do bloqueio. Duas expressões específicas bloqueiam caminhos de scripts publicitários também quando hospedados pelo próprio site. Não há correspondência especial com o placar de um benchmark.

O script `scripts/build.cjs` gera `rules/advertising.json`, `rules/privacy.json` e `filter-info.js` sem rede. Domínios são divididos em grupos de até 400, ordenados, com IDs estáveis para o snapshot. A segunda lista pode ser desligada independentemente; domínios mistos da lista principal continuam bloqueados.

O resumo gerado registra contagens, data e SHA-256 do snapshot local. Para atualizar, revise o arquivo-fonte e o catálogo, mantenha a atribuição/licença, gere novamente e rode os testes antes de distribuir outro pacote. A extensão instalada não contata o repositório.

Estas listas não incluem o conjunto completo EasyList/EasyPrivacy nem a base do uBlock Origin. A quantidade de domínios indica o tamanho da base, não a porcentagem de anúncios removidos.
