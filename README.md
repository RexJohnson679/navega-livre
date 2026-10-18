# Navega Livre

Extensão para Chrome, Brave, Edge e Firefox com bloqueio local de anúncios, proteção de cliques, ajustes do YouTube e reparo opcional de avisos de adblock.

**Versão 0.7.1 · Manifest V3 · Código próprio MIT · Sem conta ou telemetria**

## Correção da 0.7.1 — Mais foco

As opções agora são aplicadas a abas do YouTube já abertas, inclusive antes da instalação/atualização. O controlador não depende de outro content script, reutiliza a mesma instância e usa CSS empacotado/declarativo ou scripting.insertCSS, em vez de uma tag style inline sujeita à política da página. Há suporte adicional a componentes recentes e móveis, tratamento de navegação interna e um estado de foco no painel. Falhas de aplicação são informadas; salvar uma opção não é tratado como prova de que o estilo carregou.

O serviço aplica cada ação a até 64 abas de YouTube. A atualização da aba indicada tem prioridade. O arquivo CSS não é inserido de novo quando sua marca de versão já está carregada. Ao desligar ou pausar a proteção, os atributos de ativação são retirados e o conteúdo reaparece. Não há observador de DOM ou temporizador no foco.

## Renovação da 0.7

O bloqueador da 0.6.2 foi preservado. As regras de rede, listas, filtros cosméticos, políticas de pop-ups e motor de reparo permanecem idênticos. Nos scripts MAIN do YouTube e de pop-ups, mudou apenas a identificação da versão. Não houve nova medição de porcentagem de bloqueio nesta rodada.

- **Painel novo:** quatro seções, estado da página, contadores com significado explícito, temas claro/escuro/sistema e navegação por teclado.
- **Central de preferências:** controles gerais, pesquisa de domínios salvos, retomada de proteção e desativação do reparo por endereço exato.
- **Limpeza de links:** ferramenta manual com prévia. Remove apenas parâmetros conhecidos de rastreamento; mantém caminho, fragmento, parâmetros funcionais e a codificação dos campos restantes. Links com parâmetros de assinatura ou credencial reconhecidos ficam intactos.
- **Foco no YouTube:** ocultar Shorts dos feeds, comentários/chat e vídeos relacionados, independentemente. Tudo começa desligado. A folha de estilo vem no pacote; as preferências são aplicadas também às abas já abertas pela API do navegador, sem varreduras periódicas.
- **Backup local:** exportar e importar opções, listas de sites, tema e foco. A importação valida o arquivo, mostra cada opção e exige clicar em Aplicar backup. Não importa scripts, filtros remotos ou instruções executáveis.
- **Menos trabalho no painel:** os diagnósticos não são mais consultados a cada dois segundos. Atualizam ao abrir, navegar, mudar preferências ou clicar no botão ↻.

A nova versão lê as preferências anteriores normalmente; opções de foco permanecem desligadas. Não foram acrescentadas permissões. O auxiliar privado e os relatórios enviados não integram os pacotes.

## Instalar ou atualizar

Os arquivos são pacotes de teste local, sem assinatura de loja. O fluxo do repositório publica o lançamento somente depois das verificações automáticas.

| Pacote | Navegadores | Mínimo declarado |
| --- | --- | --- |
| [navega-livre-chromium-v0.7.1.zip](https://github.com/RexJohnson679/navega-livre/raw/refs/heads/main/packages/history/v0.7.1/navega-livre-chromium-v0.7.1.zip) | Chrome, Brave e Edge | Chromium 120 |
| [navega-livre-firefox-v0.7.1.zip](https://github.com/RexJohnson679/navega-livre/raw/refs/heads/main/packages/history/v0.7.1/navega-livre-firefox-v0.7.1.zip) | Firefox para computador | Firefox 128 |

**Para manter suas preferências, atualize os arquivos na pasta que já está carregada.** Guarde uma cópia da pasta anterior antes de substituí-la. Na página de extensões, recarregue a extensão e depois as páginas abertas. Mantenha uma única versão principal ativa.

**Chrome, Brave e Edge:** extraia o ZIP do Chromium. Na página de extensões, ative o modo de desenvolvedor e use Carregar sem compactação para selecionar a pasta que contém manifest.json.

**Firefox:** extraia o ZIP do Firefox e abra about:debugging#/runtime/this-firefox. Use Carregar extensão temporária e escolha manifest.json. A instalação temporária termina ao reiniciar o navegador; instalação permanente exige assinatura da Mozilla.

## Usar

- **Proteção:** pause somente o hostname da aba pelo controle grande; o controle Proteção geral afeta todos os sites.
- **YouTube:** preserva filtragem publicitária, pular quando disponível e silêncio opcional. Os controles Mais foco tratam apenas a apresentação da interface.
- **Avisos:** Tentar liberar aviso analisa a mensagem e estrutura localmente, tenta fechar/ocultar e ativa acompanhamento neste domínio. Desligue Detectar novos avisos para parar e desfazer estilos/atributos quando possível.
- **Ferramentas:** cole um link ou escolha Usar esta aba, clique em Limpar link, revise e copie. Nenhuma navegação ou requisição é feita pela limpeza. Se a cópia automática falhar, use Ctrl+C no resultado selecionado.
- **Central:** abra pelo ícone de ajustes no cabeçalho ou Gerenciar sites e backups.
- **Contadores:** representam ações na página, não pedidos de rede bloqueados ou porcentagem de eficácia. Clique em ↻ para consultar o estado atualizado.

Pausar a proteção em um hostname também pausa o foco nessa página do YouTube. Os seletores de foco foram validados no layout de computador; layouts móveis e mudanças futuras do YouTube podem exigir ajuste. Não remove o acesso direto a um vídeo de Shorts.

## Backup e privacidade

O backup contém preferências e os domínios salvos. Pode revelar seus sites escolhidos; compartilhe apenas se quiser. Não contém histórico de navegação, cookies, senhas, HTML, consultas da ferramenta de links ou contadores.

Arquivos de até 512 KB são aceitos, com no máximo 500 domínios por lista e opções tipadas. Formatos incompatíveis são recusados antes de salvar. A restauração do padrão pede confirmação e limpa as listas de sites. Os arquivos são portáveis entre as duas versões da extensão.

A ferramenta de links mantém o texto só na memória do painel. Não o inclui no diagnóstico, backup ou armazenamento local. Não há servidor próprio, código remoto ou coleta automática.

## Bloqueio e limites

As listas locais preservadas incluem EasyList/EasyPrivacy, HaGeZi Light e contribuições StevenBlack. Há 10.326 regras estáticas e 103.735 domínios referenciados, incluindo contextos e exceções. Esses números não equivalem à porcentagem de anúncios bloqueados em sites reais.

O reparo genérico continua opcional por domínio e orientado a mudanças da página, com os limites anteriores de processamento e referências. Preserva formulários, leitores, login, pagamento e assinatura. Pode fechar diálogos nativos e liberar seu fundo, mas não reconstrói conteúdo ausente ou negado pelo servidor. Alguns avisos exigem ajuste específico.

RAM total do navegador não foi medida. O CSS cosmético e o acompanhamento publicitário do YouTube permanecem como na base, para preservar seu comportamento.

## Desenvolvimento e validação

Requer Node.js 20+. Build e testes locais não precisam de rede.

```sh
npm test
npm run build:chromium
npm run build:firefox
npm run verify:builds
```

A suíte local tem 127 testes. Foi exercitada também a interface em Firefox 153 real, com APIs WebExtension simuladas: painel, temas, links, importação com revisão, gestão de sites e foco reversível. O reparo de diálogo nativo passou novamente em DOM real.

Esses testes de navegador não instalam a extensão completa e não validam DNR ou comunicação entre mundos de execução. Chromium e instalação completa do Firefox não foram executados nesta rodada. Antes de uma publicação em loja, valide os pacotes instalados nos navegadores. Detalhes em [VALIDACAO.md](VALIDACAO.md).

Testes opcionais com Playwright e Firefox instalados no ambiente de QA:

```sh
node extension/tests/renewal.firefox.e2e.cjs
node extension/tests/native-dialog.firefox.e2e.cjs
```

NAVEGA_QA_MODULES pode indicar uma pasta de módulos alternativa. NAVEGA_QA_SCREENSHOTS é opcional para inspeção local; capturas de QA não são parte dos pacotes de distribuição.

## Licenças

Código próprio: [MIT](LICENSE). Material EasyList/EasyPrivacy: CC BY-SA 3.0. HaGeZi Light: GPL-3.0, separado no seu ruleset. Licenças, fontes e hashes permanecem em extension/filters. Veja [privacidade](PRIVACIDADE.md), [histórico](CHANGELOG.md) e [origem dos filtros](extension/filters/LEIA-ME.md).

Pacotes anteriores e lançamentos: [Releases](https://github.com/RexJohnson679/navega-livre/releases). O workflow confere os arquivos e executa testes instalados antes da publicação automática.
