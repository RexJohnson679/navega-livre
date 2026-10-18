## 0.7.1 — Mais foco aplicado às abas abertas

- Preferências aplicadas pelo serviço às abas de YouTube existentes, incluindo páginas abertas antes de atualizar/instalar.
- Controlador autocontido e CSS empacotado via manifesto/API, sem depender de style inline.
- Suporte adicional a componentes recentes/móveis e navegação interna.
- Estado de foco e falhas visíveis; preserva escolhas e evita duplicar CSS e ouvintes.
- Pausa por domínio exato, desligamento reversível e limite de 64 abas por ação.
- 127 testes locais; reprodução da falha de CSP na 0.7.0 e integração de background/foco em Firefox 153 real. Testes instalados de CI ampliados.
- Motor/listas de anúncios preservados e nenhuma permissão nova.

## 0.7.0 — painel e ferramentas locais

- Painel redesenhado com quatro seções, temas claro/escuro/sistema e teclado.
- Central para opções gerais, pesquisa e remoção de preferências por hostname.
- Limpeza manual de links com prévia, preservação de assinaturas e cópia por ação.
- Foco opcional no YouTube: Shorts, comentários/chat e relacionados, via uma folha de estilo.
- Backup local com validação, revisão detalhada, cancelamento e importação entre navegadores.
- Diagnósticos do painel por eventos/ação, sem consulta periódica a cada dois segundos.
- Motor, listas e regras da 0.6.2 preservados; nenhuma permissão nova. Músicas fora do escopo conforme solicitado.
- 122 testes locais e cenários de UI/foco/reparo em Firefox 153 real. APIs de extensão simuladas nos testes de interface; instalação completa e Chromium não exercitados nesta rodada.
- Sem nova medição de eficácia ou RAM; pacotes de teste local sem assinatura de loja. Lançamento no GitHub condicionado às verificações automáticas.

## 0.6.2 — diálogos nativos com rodapé de links

- Reparo genérico de diálogo com navegação simples no rodapé; fechamento nativo e remoção da modalidade.
- Recuperação de aviso parcialmente ocultado e de diálogo marcado reaberto por código da página.
- Formulários, menus, navegação complexa e conteúdo normal preservados.
- Cinco regressões permanentes sem dependência de domínio; 103 testes locais passaram.
- Módulo validado no Firefox 153 real, incluindo controle da versão anterior e reabertura. Instalação completa e RAM total pendentes; Chromium bloqueado por restrição de sockets no ambiente.

## 0.6.1 — remoção completa da camada do aviso

- Seleção do contêiner completo, preservando os leitores e raízes da aplicação.
- Recuperação reversível de fundos aninhados: inert, aria-hidden, blur e bloqueio de cliques.
- Preserva outros filtros CSS e modais legítimos; informa reparo parcial quando necessário.
- Nenhum domínio acrescentado às listas ou ao reparo. Mesmos limites de processamento e referências.
- 98 testes locais; instalação real nos navegadores e medição de RAM pendentes neste ambiente.

## 0.6.0 — análise local de avisos em novos sites

- Detector genérico opcional por site, por texto e estrutura; sem envio de dados ou código remoto.
- Controle nativo de fechar, diálogo HTML, ocultação reversível e fundo/rolagem associados.
- Mudanças do DOM em lotes limitados, pausa em abas ocultas e limites de referências; sem heartbeat para o reparo.
- Botão informa o resultado de cada tentativa, incluindo análise limitada ou nenhum aviso reconhecido.
- Preserva as mudanças da 0.5.1 e os adaptadores existentes; remove cache de navegador dos pacotes.
- 92 testes locais; execução real em Chromium e Firefox ainda pendente neste ambiente.

## 0.5.1 — versão recebida para revisão

- Melhorias de pop-ups legítimos, salvamento de preferências, consulta do contexto de frames e agendamento adaptativo.
- Mantém tolerância de gesto de 1,2 segundo da versão recebida.

## 0.5.0 — Cobertura e avisos mistos

- EasyList/EasyPrivacy com tipos, contextos e exceções; HaGeZi Light separado no controle de privacidade.
- Seletores gerais e anúncios de download em camadas flutuantes.
- Reparo opcional de LycanToons e Vegitoons pelo controle nativo de fechar.
- Raízes de sombra abertas e restauração ao pausar.
- Pacotes de produção e testes instalados antes da publicação.
- Meta de 90% no Turtlecute; estimativa de 95,3% dos hosts, sujeita à medição nos logs.

# Histórico de versões

Os lançamentos antigos foram reconstruídos dos pacotes preservados e publicados retroativamente. As datas do GitHub correspondem a essa publicação; os commits de arquivamento não representam as datas originais do desenvolvimento.

| Versão | Pacotes preservados | Mudança principal |
| --- | --- | --- |
| [0.4.0](https://github.com/RexJohnson679/navega-livre/releases/tag/v0.4.0) | Chromium e Firefox | Proteção de pop-ups, abas publicitárias, diálogos falsos e novos filtros de página. |
| [0.3.1](https://github.com/RexJohnson679/navega-livre/releases/tag/v0.3.1) | Chromium e Firefox | Correção da API do registro do filtro do YouTube e detecção de abas antigas. |
| [0.3.0](https://github.com/RexJohnson679/navega-livre/releases/tag/v0.3.0) | Chromium e Firefox | Listas ampliadas, bloqueio de rede no Firefox, painel e controles revisados. |
| [0.2.0](https://github.com/RexJohnson679/navega-livre/releases/tag/v0.2.0) | Chromium | Filtro XHR e diagnóstico do player. |
| [0.1.0](https://github.com/RexJohnson679/navega-livre/releases/tag/v0.1.0) | Chromium e Firefox | Primeiros pacotes preservados. |

As versões 0.1.0 a 0.3.0 tinham a chamada de atualização incorreta corrigida na 0.3.1. O Firefox 0.1.0 também não declarava a lista de bloqueio de rede. Os arquivos antigos ficam disponíveis para consulta; prefira a versão recomendada no painel de Releases.

Cada tag histórico contém os scripts e manifestos extraídos dos ZIPs daquele estágio, em pastas por navegador. Metadados de publicação foram adicionados durante o arquivamento. Os ZIPs anexados são cópias exatas dos arquivos preservados, com SHA-256 para conferência.

O publicador está em `.github/scripts/publish_history.py`. O catálogo declara arquivos, checksums, notas e commits de origem. Ele publica rascunhos somente após conferir os anexos e não substitui anexos existentes. O workflow roda na branch main com a permissão `contents: write`; não modifica o comportamento da extensão instalada.
