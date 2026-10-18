# Reproduzir o pacote Firefox 0.8.0 para revisão Mozilla

Requer Node.js 20 ou mais recente. O build é determinístico e offline: não execute npm install para construir. Extraia o pacote de código-fonte e abra o terminal na pasta que contém package.json e extension/.

```sh
node --version
npm run build:firefox
```

A extensão produzida está em dist/firefox/. O ZIP de submissão contém os arquivos dessa pasta na raiz, com manifest.json. Compare os bytes extraídos do ZIP de submissão com os arquivos gerados; metadados/compactação do arquivo ZIP não afetam o código da extensão.

As listas e suas licenças ficam em extension/filters/. O script extension/scripts/build.cjs confere os hashes dos snapshots contra filters/provenance.json, compila as regras locais e CSS cosmético, e concatena os arquivos locais filter-data.js, popup-policy.js e popup-main.js em popup-main-bundle.js. Esse bundle é usado pelo Chromium; Firefox usa os arquivos MAIN ordenados, sem executar código obtido da rede. Não há minificação, ofuscação ou avaliação dinâmica de código baixado.

O código próprio usa MIT; as licenças de cada fonte de filtros estão incluídas. O pacote de código-fonte para AMO contém o runtime, os scripts de build e as fontes locais dos filtros. Os testes de QA estão no repositório GitHub, não são necessários ao build e não integram o pacote de produção.

Para construir os dois navegadores no repositório completo:

```sh
npm test
npm run build:chromium
npm run build:firefox
npm run verify:builds
```

As duas pastas de produção usam os mesmos arquivos, exceto manifest.json. O manifesto de Firefox contém o ID, scripts de segundo plano e a declaração de Android. Envie o ZIP Firefox ao AMO; o ZIP Chromium usa service_worker e não é um pacote Mozilla.
