'use strict';
const C = NavegaCore;
const T = NavegaTools;
const api = typeof browser !== 'undefined' ? browser : chrome;
const $ = id => document.getElementById(id);
let tab = null, settings = C.normalizeConfig(), page = null, busy = false, refreshing = false, youtubeDiagnostic = null, popupDiagnostic = null, network = null;
let preferences = T.normalize();
let focusDiagnostic=null, android=false;
const tabNames = ['general', 'youtube', 'repair', 'tools'];
function applyTheme() {
  document.documentElement.dataset.theme = preferences.theme;
  $('theme').setAttribute('aria-label', 'Tema: ' + ({system:'sistema', dark:'escuro', light:'claro'}[preferences.theme]) + '. Clique para alternar.');
}
async function savePreferences(patch) {
  const data = await api.storage.local.get('preferences');
  const next = T.normalize({...T.normalize(data.preferences), ...patch});
  await api.storage.local.set({preferences:next});
  preferences = next;
  applyTheme();
}
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
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabNames.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabNames.length - 1)) % tabNames.length;
    selectPanel(tabNames[next], true);
  });
}
function tell(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
async function request(message) {
  const result = await api.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || 'Não foi possível concluir.');
  if (result.config) settings = result.config;
  if (result.network) network = result.network;
  if (result.preferences) preferences = T.normalize(result.preferences);
  return result;
}
function render() {
  const host = C.normalizeHost(tab?.url || '');
  const on = host && C.active(settings, host);
  $('hostname').textContent = host || 'Página não suportada';
  $('status').textContent = on ? 'ATIVA' : 'PAUSADA';
  $('status').classList.toggle('off', !on);
  if (!busy) $('siteEnabled').checked = host && !settings.disabledHosts.includes(host);
  $('siteEnabled').disabled = !host || busy;
  for (const key of C.OPTIONS) { if (!busy) $(key).checked = settings[key]; $(key).disabled = busy; }
  for (const key of ['privacy', 'cosmetics', 'popups', 'youtube']) $(key).disabled = busy || !settings.enabled;
  for (const key of ['skipAds', 'muteAds']) $(key).disabled = busy || !settings.enabled || !settings.youtube;
  if (!busy) $('autoRepair').checked = settings.repairHosts.includes(host);
  $('autoRepair').disabled = !on || busy;
  $('repair').disabled = !on || busy;
  $('reload').disabled = !host || busy;
  $('refresh').disabled = busy;
  $('useCurrentLink').disabled = !host || busy;
  $('cleanLink').disabled = busy;
  $('copyLink').disabled = busy || !$('linkOutput').value;
  for (const key of ['focusShorts','focusComments','focusRelated']) {
    if (!busy) $(key).checked = preferences[key];
    $(key).disabled = busy;
  }
  const focusStatus=$('focusState');
  focusStatus.classList.toggle('error',Boolean(focusDiagnostic?.error));
  focusStatus.textContent=!C.youtubeHost(host)||focusDiagnostic?.supported===false?'As escolhas serão aplicadas às abas do YouTube de vídeos.':focusDiagnostic?.error
    ?'Foco não aplicado nesta aba: '+focusDiagnostic.error:!focusDiagnostic?'Verificando o foco nesta aba…':!focusDiagnostic.active
    ?'Foco pausado pela proteção geral ou por este site.':!focusDiagnostic.cssLoaded?'A folha de estilo do foco não carregou.':
      ['focusShorts','focusComments','focusRelated'].some(key=>preferences[key])?'Foco carregado nesta aba. Novos elementos também recebem o estilo.':'Foco desligado nas preferências.';
  $('hiddenCount').textContent = page ? String(page.adsHidden || 0) : '—';
  $('skipCount').textContent = page ? String(page.skipClicks || 0) : '—';
  $('popupCount').textContent = popupDiagnostic?.main?.installed
    ? String((popupDiagnostic.main.popupsBlocked || 0) + (popupDiagnostic.tabsClosed || 0)) : '—';
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
    // The privacy switch enables two rulesets. Their domains overlap, so with everything on the deduplicated total is shown.
    const sets = network.enabledRulesets, info = C.FILTER_INFO;
    const count = ['advertising', 'privacy', 'privacyExtended'].every(id => sets.includes(id)) ? info.totalDomains :
      (sets.includes('advertising') ? info.advertisingDomains : 0) +
      (sets.includes('privacy') ? info.privacyDomains : 0) +
      (sets.includes('privacyExtended') ? info.extendedPrivacyDomains : 0);
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
  // The page may have navigated since the panel opened; keep the site shown in sync with the tab.
  if (tab?.id != null) { try { tab = await api.tabs.get(tab.id); } catch { /* The tab was closed. */ } }
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
    try { focusDiagnostic=(await request({type:'GET_FOCUS_DIAGNOSTIC',tabId:tab.id})).focus; }
    catch(error){focusDiagnostic={error:error.message};}
  } else { youtubeDiagnostic = null; focusDiagnostic=null; }
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
  if (enabled) tell('Analisando o aviso nesta página…');
  const result = await request({type: 'SET_REPAIR', tabId: tab.id, enabled});
  await refreshPage();
  if (!enabled) { tell('Ajuste automático desligado. Recarregue para desfazer também o adaptador específico.'); return; }
  if (!result.page) { tell('Preferência salva. Recarregue a página e tente novamente.'); return; }
  const repair = result.page.repair;
  // Android's action overlay can hide the underlying document. The saved
  // opt-in resumes the bounded repair controller on visibilitychange when
  // this overlay closes; do not keep asking the user to retry behind it.
  if (android && repair?.limited && !result.known) {
    tell('Detecção ativada. Voltando à página para analisar o aviso.');
    window.close();
    return;
  }
  if (repair?.state === 'partial') { tell('O aviso foi ocultado, mas o conteúdo ainda apresenta um bloqueio. Alguns estados internos do site exigem um ajuste específico.'); return; }
  if (result.known || repair?.repaired > 0 || (!repair && result.page.noticesHidden > 0)) tell('Aviso fechado ou ocultado. Confira o conteúdo. A detecção continua ativa neste site.');
  else if (repair?.state === 'error' || repair?.limited) tell('A análise atingiu um limite. O aviso pode exigir um ajuste específico; tente novamente com ele visível.');
  else tell('Nenhum aviso reconhecido agora. A detecção continua ativa neste site; alguns bloqueios exigem um ajuste específico.');
}
$('repair').addEventListener('click', () => run(() => repair(true)));
$('autoRepair').addEventListener('change', event => {
  const enabled = event.target.checked; run(() => repair(enabled));
});
$('reload').addEventListener('click', () => run(async () => { await api.tabs.reload(tab.id); window.close(); }));
$('refresh').addEventListener('click', () => run(async () => { await refreshPage(); tell('Contadores atualizados para esta página.'); }));
for (const key of ['focusShorts','focusComments','focusRelated']) {
  $(key).addEventListener('change', event => {
    const value = event.target.checked;
    run(async () => {
      const result=await request({type:'SET_FOCUS_OPTION',key,value,tabId:tab?.id});
      await refreshPage();
      tell(result.focusSync?.failed?'Preferência salva, mas não foi possível aplicar em alguma aba. Veja o estado do foco.':result.focusSync?.limited
        ?'Preferência salva e aplicada a até 64 abas do YouTube. Recarregue as demais.':'Preferência salva e aplicada às abas abertas do YouTube.');
    });
  });
}
$('theme').addEventListener('click', () => run(async () => {
  const next = T.THEMES[(T.THEMES.indexOf(preferences.theme) + 1) % T.THEMES.length];
  await savePreferences({theme:next});
  tell('Tema: ' + ({system:'acompanhar o sistema',dark:'escuro',light:'claro'}[next]) + '.');
}));
async function openSettings() { await api.runtime.openOptionsPage(); }
$('settings').addEventListener('click', () => run(openSettings));
$('manageSites').addEventListener('click', () => run(openSettings));
function invalidateLink() {
  $('linkPreview').hidden = true; $('linkOutput').value = ''; $('linkState').textContent = '';
  $('copyLink').disabled = true;
}
$('linkInput').addEventListener('input', invalidateLink);
$('useCurrentLink').addEventListener('click', () => run(async () => {
  tab = await api.tabs.get(tab.id);
  if (!C.normalizeHost(tab.url || '')) throw Error('Abra um site HTTP ou HTTPS.');
  invalidateLink(); $('linkInput').value = tab.url;
  tell('Link preenchido localmente. Clique em Limpar link para revisar.');
}));
$('cleanLink').addEventListener('click', () => run(async () => {
  const result = T.cleanLink($('linkInput').value);
  $('linkOutput').value = result.url; $('linkPreview').hidden = false;
  $('linkState').textContent = result.protected ? 'Link com assinatura ou credencial: mantido intacto para preservar o acesso.' : result.removed.length
    ? result.removed.length + ' tipo(s) de parâmetro de rastreamento removido(s). Caminho e demais parâmetros preservados.'
    : 'Nenhum parâmetro conhecido de rastreamento encontrado.';
  tell('Confira o resultado. A extensão não abriu nem enviou esse link.');
}));
$('copyLink').addEventListener('click', () => run(async () => {
  if (!$('linkOutput').value) return;
  try { await navigator.clipboard.writeText($('linkOutput').value); tell('Link copiado.'); }
  catch { $('linkOutput').focus(); $('linkOutput').select(); tell(android
    ? 'Toque e segure o resultado selecionado e escolha Copiar.'
    : 'O navegador não autorizou a cópia. Use Ctrl+C no resultado selecionado.'); }
}));
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
    try { android = (await api.runtime.getPlatformInfo?.())?.os === 'android'; } catch { /* A desktop without this optional API remains usable. */ }
    if (api.storage?.local) {
      const data = await api.storage.local.get('preferences');
      preferences = T.normalize(data.preferences);
    }
    applyTheme();
    [tab] = await api.tabs.query({active: true, currentWindow: true});
    if (C.youtubeHost(tab?.url || '')) selectPanel('youtube');
    await refreshPage();
    if (C.normalizeHost(tab?.url || '') && !page) tell('Recarregue a página uma vez para iniciar a extensão nesta aba.');
    else if (!C.normalizeHost(tab?.url || '')) tell('Abra um site comum. Páginas internas do navegador não podem ser modificadas.');
  } catch (error) { tell(error.message, true); render(); }
})();
// No popup heartbeat. Refresh on open, navigation, explicit action and preference changes.
api.tabs.onUpdated?.addListener((id, change) => {
  if (id !== tab?.id || (!change.url && change.status !== 'complete')) return;
  if (change.url) invalidateLink();
  if (!busy) refreshPage().catch(() => {});
});
api.storage?.onChanged?.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.preferences) { preferences = T.normalize(changes.preferences.newValue); applyTheme(); }
  if (!busy && (changes.config || changes.preferences)) refreshPage().catch(() => {});
});
