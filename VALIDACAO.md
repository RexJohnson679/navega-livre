# Validação — Navega Livre 0.8.0

A versão inclui declaração Firefox Android 128+, painel responsivo e alvos de toque, cópia manual adequada ao Android e retorno à página depois de salvar o reparo quando o painel mantém o documento oculto.

## Conferido localmente

- 130 testes Node: aprovados, incluindo retorno do painel Android apenas depois de salvar, preservação de erros/resultado parcial e falha na consulta opcional de plataforma.
- Firefox 153 real: interface e interações com toque em 320×640, 360×740, 412×850 e 800×360. Os quatro painéis e a central não ultrapassaram a largura; controles de cabeçalho/abas têm pelo menos 44 px. APIs usadas nesse cenário são fixtures, não um dispositivo Android.
- Interface renovada e aplicação do foco em duas abas com CSP restrita: aprovadas novamente em Firefox 153, com adaptadores locais das primitivas de browser API.
- Os builds contêm os mesmos arquivos, com diferenças somente no manifesto. Sem permissões novas.
- Regras/listas/CSS cosmético, content.js, reparo, políticas e bridges idênticos aos da 0.7.1. Nos scripts MAIN e controlador de foco mudou apenas a versão.
- web-ext 10.8.0: zero erros; avisos de metadados recentes de privacidade em versões antigas e assinatura de minerador dentro de uma regra que bloqueia scripts de rede. Não há minerador executável.

## Validação nativa e publicação

O workflow exige os cenários com extensão instalada no Chromium e Firefox e um teste separado com Firefox Android em emulador descartável. Esse último copia os arquivos de runtime sem modificar seus bytes e acrescenta somente um script de QA ao segundo plano. Não acrescenta permissões. Confere plataforma Android, DNR, registro MAIN, bloqueio/pausa/reversão de um script servido localmente, cosméticos, reparo/reversão e CSS de foco em componente móvel.

Resultado final do CI deve ser consultado no commit correspondente. Não há ainda resultado local em aparelho Android: o ambiente local não dispõe do SDK/KVM. O teste emulado não representa todos os aparelhos ou reprodução ao vivo no YouTube. Não foram medidas RAM e bateria no Android, nem feita nova afirmação de eficácia universal. A medição de 95,45% da 0.7.1 permanece apenas um registro daquela execução no Firefox.

O pacote de código-fonte para revisão Mozilla contém o código e os snapshots necessários ao build offline; BUILD-FIREFOX.md descreve os comandos. Auxiliar privado, relatórios recebidos, imagens do usuário, dados de investigação e capturas de QA não integram os pacotes ou o repositório.
