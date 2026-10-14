'use strict';
const C = NavegaCore;
const api = typeof browser !== 'undefined' ? browser : chrome;
const $ = id => document.getElementById(id);
let tab = null, settings = C.normalizeConfig(), page = null, busy = false, refreshing = false, youtubeDiagnostic = null, popupDiagnostic = null, network = null;
const tabNames = ['general', 'youtube', 'repair'];
function selectPanel(name, focus = false) {
  for (const item of tabNames) {
    $('tab-' + item).setAttribute('aria-selected', String(item === name));
    $('tab-' + item).tabIndex = item === name ? 0 : -1;
    $('panel-' + item).hidden = item !== name;
  }
  if (focus) $('tab-' + name).focus();
}
for (const [index, name] of tabNames.entries()) {
  $('tab-' + name).addEventListener('click', () => selectPanel(name));
  $('tab-' + name).addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
    selectPanel(tabNames[next], true);
  });
}
function tell(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
async function request(message) {
  const result = await api.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || 'Não foi possível concluir.');
  if (result.config) settings = result.config;
  if (result.network) network = result.network;
  return result;
}
function render() {
  const host = C.normalizeHost(tab?.url || '');
  const on = host && C.active(settings, host);
  $('hostname').textContent = host || 'Página não suportada';
  $('status').textContent = on ? 'ATIVA' : 'PAUSADA';
  $('status').classList.toggle('off', !on);
  $('siteEnabled').checked = host && !settings.disabledHosts.includes(host);
  $('siteEnabled').disabled = !host || busy;
  for (const key of C.OPTIONS) { $(key).checked = settings[key]; $(key).disabled = busy; }
  for (const key of ['privacy', 'cosmetics', 'popups', 'youtube']) $(key).disabled = busy || !settings.enabled;
  for (const key of ['skipAds', 'muteAds']) $(key).disabled = busy || !settings.enabled || !settings.youtube;
  $('autoRepair').checked = settings.repairHosts.includes(host);
  $('autoRepair').disabled = !on || busy;
  $('repair').disabled = !on || busy;
  $('reload').disabled = !host || busy;
  $('hiddenCount').textContent = page ? String(page.adsHidden || 0) : '—';
  $('skipCount').textContent = page ? String(page.skipClicks || 0) : '—';
  const popupStatus = $('popupState');
  popupStatus.classList.remove('error');
  if (!on || !settings.popups) popupStatus.textContent = 'Proteção de abas pausada aqui.';
  else if (popupDiagnostic?.registration?.error || popupDiagnostic?.error) {
    popupStatus.textContent = 'Falha na proteção de abas: ' + (popupDiagnostic.registration?.error || popupDiagnostic.error);
    popupStatus.classList.add('error');
  } else if (!popupDiagnostic) popupStatus.textContent = 'Verificando a proteção de abas…';
  else if (!popupDiagnostic.main?.installed || (popupDiagnostic.main.version && popupDiagnostic.main.version !== popupDiagnostic.expectedVersion)) {
    popupStatus.textContent = 'Recarregue esta página para iniciar a proteção de abas atual.';
  } else {
    const main = popupDiagnostic.main;
    popupStatus.textContent = `Proteção carregada · ${main.popupsBlocked + (popupDiagnostic.tabsClosed || 0)} aberturas bloqueadas · ${main.linksBlocked} links publicitários · ${main.dialogsBlocked} avisos falsos.`;
  }
  const networkLabel = $('networkState');
  networkLabel.classList.toggle('error', Boolean(network?.error));
  if (network?.error) networkLabel.textContent = 'Falha no bloqueio de rede: ' + network.error;
  else if (!network) networkLabel.textContent = 'Verificando o bloqueio de rede…';
  else if (!on) networkLabel.textContent = 'Bloqueio de rede pausado aqui. Recarregue a página após mudar esta opção.';
  else {
    const count = (network.enabledRulesets.includes('advertising') ? C.FILTER_INFO.advertisingDomains : 0) +
      (network.enabledRulesets.includes('privacy') ? C.FILTER_INFO.privacyDomains : 0);
    networkLabel.textContent = 'Rede carregada · ' + count.toLocaleString('pt-BR') + ' domínios nas listas ativas.';
  }
  const playerStatus = $('youtubeState');
  playerStatus.hidden = !C.youtubeHost(host);
  playerStatus.classList.remove('error');
  if (!on || !settings.youtube) playerStatus.textContent = 'Filtro do player pausado. Recarregue para desfazer os ajustes.';
  else if (youtubeDiagnostic?.registration?.error || youtubeDiagnostic?.error) {
    playerStatus.textContent = 'Falha no filtro: ' + (youtubeDiagnostic.registration?.error || youtubeDiagnostic.error);
    playerStatus.classList.add('error');
  } else if (!youtubeDiagnostic) playerStatus.textContent = 'Verificando o filtro do player…';
  else if (!youtubeDiagnostic.main?.installed) {
    playerStatus.textContent = 'Recarregue esta aba: o filtro do player ainda não carregou.';
    playerStatus.classList.add('error');
  } else if (youtubeDiagnostic.main.version && youtubeDiagnostic.expectedVersion && youtubeDiagnostic.main.version !== youtubeDiagnostic.expectedVersion) {
    playerStatus.textContent = 'Esta aba ainda usa o filtro ' + youtubeDiagnostic.main.version + '. Feche-a e abra uma nova para carregar a versão atual.';
    playerStatus.classList.add('error');
  } else if (!youtubeDiagnostic.main.enabled) {
    playerStatus.textContent = 'O filtro desta aba está pausado. Recarregue se acabou de ativá-lo.';
  } else {
    const main = youtubeDiagnostic.main;
    playerStatus.textContent = `Filtro carregado · ${main.fetchMatched + main.xhrMatched} respostas examinadas · ${main.adFieldsRemoved} campos publicitários removidos. Estes números não contam vídeos de anúncios.`;
  }
}
async function refreshPage() {
  if (refreshing) return;
  refreshing = true;
  try {
  await request({type: 'GET_CONFIG'});
  if (C.normalizeHost(tab?.url || '')) {
    try { popupDiagnostic = await request({type: 'GET_POPUP_DIAGNOSTIC', tabId: tab.id}); }
    catch (error) { popupDiagnostic = {error: error.message}; }
  } else popupDiagnostic = null;
  try { page = await api.tabs.sendMessage(tab.id, {type: 'PAGE_STATUS'}, {frameId: 0}); }
  catch { page = null; }
  if (C.youtubeHost(tab?.url || '')) {
    try { youtubeDiagnostic = await request({type: 'GET_YOUTUBE_DIAGNOSTIC', tabId: tab.id}); }
    catch (error) { youtubeDiagnostic = {error: error.message}; }
  } else youtubeDiagnostic = null;
  render();
  } finally { refreshing = false; }
}
async function run(task) {
  if (busy) return;
  busy = true; render();
  try { await task(); }
  catch (error) { tell(error.message, true); }
  finally { busy = false; render(); }
}
for (const key of C.OPTIONS) {
  $(key).addEventListener('change', event => {
    const value = event.target.checked;
    run(async () => {
      await request({type: 'SET_OPTION', key, value});
      await refreshPage();
      tell('Preferência salva. Recarregue a página para aplicar o bloqueio às novas requisições.');
    });
  });
}
$('siteEnabled').addEventListener('change', event => {
  const value = event.target.checked;
  run(async () => {
    await request({type: 'SET_SITE', tabId: tab.id, enabled: value});
    await refreshPage();
    tell('Preferência salva para este endereço. Recarregue a página para reaplicar os pedidos de rede.');
  });
});
async function repair(enabled) {
  const result = await request({type: 'SET_REPAIR', tabId: tab.id, enabled});
  await refreshPage();
  if (!enabled) { tell('Ajuste automático desligado. Recarregue para desfazer também o adaptador específico.'); return; }
  if (!result.page) { tell('Preferência salva. Recarregue a página e tente novamente.'); return; }
  if (result.known || result.page.noticesHidden > 0) tell('Ajuste aplicado. Confira se o conteúdo e os botões funcionam.');
  else tell('Nenhum aviso compatível encontrado. Alguns sites exigem um ajuste específico.');
}
$('repair').addEventListener('click', () => run(() => repair(true)));
$('autoRepair').addEventListener('change', event => {
  const enabled = event.target.checked; run(() => repair(enabled));
});
$('reload').addEventListener('click', () => run(async () => { await api.tabs.reload(tab.id); window.close(); }));
$('report').addEventListener('click', () => run(async () => {
  await refreshPage();
  const safeUrl = tab?.url && /^https?:/.test(tab.url) ? new URL(tab.url) : null;
  const diagnostic = {
    extension: 'Navega Livre', version: api.runtime.getManifest().version,
    target: api.runtime.getManifest().browser_specific_settings ? 'firefox' : 'chromium',
    page: safeUrl ? safeUrl.origin : 'não suportada',
    settings: {enabled: settings.enabled, privacy: settings.privacy, cosmetics: settings.cosmetics, popups: settings.popups, youtube: settings.youtube, skipAds: settings.skipAds, muteAds: settings.muteAds,
      pausedHere: settings.disabledHosts.includes(safeUrl?.hostname), repairHere: settings.repairHosts.includes(safeUrl?.hostname)},
    counters: page, youtube: youtubeDiagnostic, popups: popupDiagnostic, network, filters: C.FILTER_INFO,
    note: 'Contadores locais de interface; não representam pedidos bloqueados. Sem cookies, tokens, HTML, caminho ou parâmetros da URL.'
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(diagnostic, null, 2)], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'navega-livre-diagnostico.json';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  tell('Download do diagnóstico solicitado.');
}));
(async () => {
  try {
    $('version').textContent = api.runtime.getManifest().version;
    [tab] = await api.tabs.query({active: true, currentWindow: true});
    if (C.youtubeHost(tab?.url || '')) selectPanel('youtube');
    await refreshPage();
    if (C.normalizeHost(tab?.url || '') && !page) tell('Recarregue a página uma vez para iniciar a extensão nesta aba.');
    else if (!C.normalizeHost(tab?.url || '')) tell('Abra um site comum. Páginas internas do navegador não podem ser modificadas.');
  } catch (error) { tell(error.message, true); render(); }
})();
setInterval(() => { if (tab?.id && !busy && !document.hidden) refreshPage().catch(() => {}); }, 2000);
