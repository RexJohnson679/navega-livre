'use strict';
const C = NavegaCore;
const $ = id => document.getElementById(id);
let tab = null, settings = C.normalizeConfig(), page = null, busy = false, youtubeDiagnostic = null;
function tell(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
async function request(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || 'Não foi possível concluir.');
  if (result.config) settings = result.config;
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
  for (const key of ['enabled', 'youtube', 'skipAds', 'muteAds']) { $(key).checked = settings[key]; $(key).disabled = busy; }
  $('autoRepair').checked = settings.repairHosts.includes(host);
  $('autoRepair').disabled = !on || busy;
  $('repair').disabled = !on || busy;
  $('reload').disabled = !host || busy;
  $('hiddenCount').textContent = page ? String(page.adsHidden || 0) : '—';
  $('skipCount').textContent = page ? String(page.skipClicks || 0) : '—';
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
  } else if (!youtubeDiagnostic.main.enabled) {
    playerStatus.textContent = 'O filtro desta aba está pausado. Recarregue se acabou de ativá-lo.';
  } else {
    const main = youtubeDiagnostic.main;
    playerStatus.textContent = `Filtro carregado · ${main.fetchMatched + main.xhrMatched} respostas examinadas · ${main.adFieldsRemoved} campos de publicidade removidos. Isso não conta anúncios de vídeo removidos.`;
  }
}
async function refreshPage() {
  try { page = await chrome.tabs.sendMessage(tab.id, {type: 'PAGE_STATUS'}); }
  catch { page = null; }
  if (C.youtubeHost(tab?.url || '')) {
    try { youtubeDiagnostic = await request({type: 'GET_YOUTUBE_DIAGNOSTIC', tabId: tab.id}); }
    catch (error) { youtubeDiagnostic = {error: error.message}; }
  } else youtubeDiagnostic = null;
  render();
}
async function run(task) {
  if (busy) return;
  busy = true; render();
  try { await task(); }
  catch (error) { tell(error.message, true); }
  finally { busy = false; render(); }
}
for (const key of ['enabled', 'youtube', 'skipAds', 'muteAds']) {
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
$('reload').addEventListener('click', () => run(async () => { await chrome.tabs.reload(tab.id); window.close(); }));
$('report').addEventListener('click', () => run(async () => {
  await refreshPage();
  const safeUrl = tab?.url && /^https?:/.test(tab.url) ? new URL(tab.url) : null;
  const diagnostic = {
    extension: 'Navega Livre', version: chrome.runtime.getManifest().version,
    page: safeUrl ? safeUrl.origin + safeUrl.pathname : 'não suportada',
    settings: {enabled: settings.enabled, youtube: settings.youtube, skipAds: settings.skipAds, muteAds: settings.muteAds,
      pausedHere: settings.disabledHosts.includes(safeUrl?.hostname), repairHere: settings.repairHosts.includes(safeUrl?.hostname)},
    counters: page, youtube: youtubeDiagnostic, adDomains: C.AD_DOMAINS.length,
    note: 'Contadores locais de interface; não representam pedidos bloqueados. Sem cookies, tokens, HTML ou parâmetros da URL.'
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(diagnostic, null, 2)], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'navega-livre-diagnostico.json';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  tell('Download do diagnóstico solicitado.');
}));
(async () => {
  try {
    [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    await request({type: 'GET_CONFIG'});
    await refreshPage();
    if (C.normalizeHost(tab?.url || '') && !page) tell('Recarregue a página uma vez para iniciar a extensão nesta aba.');
    else if (!C.normalizeHost(tab?.url || '')) tell('Abra um site comum. Páginas internas do navegador não podem ser modificadas.');
  } catch (error) { tell(error.message, true); render(); }
})();
setInterval(() => { if (tab?.id && !busy && !document.hidden) refreshPage().catch(() => {}); }, 2000);
