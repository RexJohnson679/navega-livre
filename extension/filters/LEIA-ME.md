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

## Revisão 0.5.0

O build também usa snapshots de 18 arquivos do EasyList/EasyPrivacy e HaGeZi Light. `provenance.json` registra commit e hash Git de cada snapshot; o build recusa bytes que não correspondam ao hash. Material EasyList/EasyPrivacy e derivados conservam CC BY-SA 3.0; HaGeZi fica GPL-3.0 em `rules/privacy-extended.json`, com snapshot e licença completos. Código próprio do conversor permanece MIT.

O subconjunto converte domínios e caminhos, tipos positivos/negativos de recursos, primeira/terceira parte, domínios de origem e exceções. Bloqueios importantes superam exceções de lista; a pausa explícita do usuário tem prioridade maior. Sintaxe não suportada, redirecionamentos e scriptlets são descartados e contados. Navegação principal é excluída. Não se trata de um motor ABP/uBlock completo.

Seletores gerais geram CSS condicionado aos cosméticos, com exceções por host. Seletores de login, assinatura e avisos de adblock são excluídos desse CSS. Reparo de avisos permanece optativo. HaGeZi usa recursos de terceiros e segue a opção de privacidade.

nap5k.com e n6wxm.com foram observados nos relatos e constam do EasyList. Não há regra exclusiva para o benchmark ou alteração de suas requisições/resultado. Contagens de domínios descrevem a base, não uma porcentagem de anúncios removidos.

## Revisão 0.4.0

Foram incluídos `pubadx.one`, `diveinthebluesky.biz`, `pa.diffgremio.com` e `acscdn.com` a partir de scripts e slots observados no DOM público de uma página com anúncios. O catálogo resultante possui 3.003 domínios publicitários e 60 de rastreamento. O arquivo `filter-data.js` é gerado offline do mesmo catálogo publicitário usado em DNR; os filtros de elementos e o protetor de pop-ups não dependem de listas remotas.
