'use strict';
const C = NavegaCore, T = NavegaTools;
const api = typeof browser !== 'undefined' ? browser : chrome;
const $ = id => document.getElementById(id);
let config = C.normalizeConfig(), preferences = T.normalize(), network = null, pending = null, busy = false;
const focusKeys = ['focusShorts','focusComments','focusRelated'];
function tell(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
async function request(message) {
  const result = await api.runtime.sendMessage(message);
  if (!result?.ok) throw Error(result?.error || 'Não foi possível salvar.');
  if (result.config) config = C.normalizeConfig(result.config);
  if (result.network) network = result.network;
  if (result.preferences) preferences = T.normalize(result.preferences);
  return result;
}
function renderSites(list, id) {
  const container = $(id), filter = $('siteFilter').value.trim().toLowerCase();
  container.replaceChildren();
  const matches = config[list].filter(host => host.includes(filter));
  if (!matches.length) {
    const empty = document.createElement('p'); empty.className = 'empty';
    empty.textContent = config[list].length ? 'Nenhum site corresponde à busca.' : 'Nenhum site salvo nesta lista.';
    container.appendChild(empty); return;
  }
  for (const host of matches) {
    const row = document.createElement('div'); row.className = 'site-item';
    const label = document.createElement('code'); label.textContent = host;
    const button = document.createElement('button');
    button.textContent = list === 'disabledHosts' ? 'Retomar proteção' : 'Desativar reparo';
    button.setAttribute('aria-label', button.textContent + ' em ' + host); button.disabled = busy;
    button.addEventListener('click', () => run(async () => {
      await request({type:'REMOVE_SITE_SETTING',list,host});
      tell('Preferência removida de ' + host + '. Recarregue páginas abertas para reaplicar a rede ou desfazer reparos.');
    }));
    row.append(label, button); container.appendChild(row);
  }
}
function render() {
  document.documentElement.dataset.theme = preferences.theme;
  for (const key of C.OPTIONS) { if (!busy) $(key).checked = config[key]; $(key).disabled = busy; }
  for (const key of ['privacy','cosmetics','popups','youtube']) $(key).disabled = busy || !config.enabled;
  for (const key of ['skipAds','muteAds']) $(key).disabled = busy || !config.enabled || !config.youtube;
  for (const key of focusKeys) { if (!busy) $(key).checked = preferences[key]; $(key).disabled = busy; }
  if (!busy) $('theme').value = preferences.theme;
  $('theme').disabled = busy;
  for (const key of ['exportBackup','importFile','reset','cancelImport']) $(key).disabled = busy;
  $('applyImport').disabled = busy || !pending;
  $('pausedTotal').textContent = String(config.disabledHosts.length);
  $('repairTotal').textContent = String(config.repairHosts.length);
  $('networkState').classList.toggle('error', Boolean(network?.error));
  $('networkState').textContent = network?.error ? 'Falha de rede: ' + network.error : config.enabled
    ? 'Listas locais carregadas. Recarregue após mudar a proteção de rede.' : 'Proteção geral pausada.';
  renderSites('disabledHosts','pausedList'); renderSites('repairHosts','repairList');
}
async function refresh() {
  await request({type:'GET_CONFIG'});
  const data = await api.storage.local.get('preferences'); preferences = T.normalize(data.preferences); render();
}
async function run(task) {
  if (busy) return;
  busy = true; render();
  try { await task(); } catch (error) { tell(error.message, true); }
  finally { busy = false; render(); }
}
for (const key of C.OPTIONS) $(key).addEventListener('change', event => {
  const value = event.target.checked;
  run(async () => { await request({type:'SET_OPTION',key,value}); tell('Preferência salva. Recarregue páginas abertas após mudar o bloqueio de rede.'); });
});
async function savePreference(key, value) {
  if(focusKeys.includes(key)){
    const result=await request({type:'SET_FOCUS_OPTION',key,value});
    tell(result.focusSync?.failed?'Preferência salva; não foi possível aplicar em alguma aba do YouTube. Abra o painel dessa aba para verificar.':
      result.focusSync?.limited?'Preferência aplicada a até 64 abas do YouTube. Recarregue as demais.':'Foco salvo e aplicado às abas abertas do YouTube.');
    return;
  }
  const data = await api.storage.local.get('preferences');
  const next = T.normalize({...T.normalize(data.preferences), [key]:value});
  await api.storage.local.set({preferences:next}); preferences = next;
  tell('Preferência salva localmente.');
}
for (const key of focusKeys) $(key).addEventListener('change', event => {
  const value = event.target.checked; run(() => savePreference(key, value));
});
$('theme').addEventListener('change', event => { const value = event.target.value; run(() => savePreference('theme',value)); });
$('siteFilter').addEventListener('input', () => { renderSites('disabledHosts','pausedList'); renderSites('repairHosts','repairList'); });
function download(data, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url),5000);
}
$('exportBackup').addEventListener('click', () => run(async () => {
  await refresh();
  download(T.createBackup(config,preferences,api.runtime.getManifest().version),'navega-livre-preferencias.json');
  tell('Download solicitado. O backup inclui seus domínios salvos.');
}));
function clearImport() { pending = null; $('importPreview').hidden = true; $('importFile').value = ''; $('importSummary').textContent = ''; $('importOptions').replaceChildren(); }
$('importFile').addEventListener('change', event => {
  const file = event.target.files?.[0];
  run(async () => {
    clearImport();
    if (!file) return;
    if (file.size > T.BACKUP_LIMIT) throw Error('O backup deve ter até 512 KB.');
    const text = await file.text(), data = T.readBackup(text);
    pending = text; $('importPreview').hidden = false;
    $('importSummary').textContent = 'Proteção geral: ' + (data.config.enabled ? 'ativa' : 'pausada') + '. ' + data.config.disabledHosts.length +
      ' site(s) com proteção pausada; ' + data.config.repairHosts.length + ' com reparo automático. Tema: ' +
      ({system:'sistema',dark:'escuro',light:'claro'}[data.preferences.theme]) + '. ' + focusKeys.filter(key => data.preferences[key]).length + ' opção(ões) de foco ativa(s).';
    const labels={enabled:'Proteção geral',privacy:'Bloquear rastreadores',cosmetics:'Ocultar anúncios',popups:'Proteger novas abas',youtube:'Publicidade no YouTube',skipAds:'Pular anúncios',muteAds:'Silenciar anúncios',focusShorts:'Ocultar Shorts',focusComments:'Ocultar comentários',focusRelated:'Ocultar relacionados'};
    for (const key of [...C.OPTIONS,...focusKeys]) {
      const item=document.createElement('li');
      item.textContent=labels[key]+': '+((focusKeys.includes(key)?data.preferences[key]:data.config[key])?'ligado':'desligado');
      $('importOptions').appendChild(item);
    }
    tell('Backup válido. Revise o resumo e clique em Aplicar backup.');
  });
});
$('cancelImport').addEventListener('click', () => { clearImport(); render(); tell('Importação cancelada.'); });
$('applyImport').addEventListener('click', () => run(async () => {
  if (!pending) return;
  await request({type:'APPLY_BACKUP',text:pending}); clearImport();
  tell(network?.error ? 'Backup salvo; a rede apresentou um erro. Confira o estado de proteção.' : 'Backup aplicado. Recarregue as páginas abertas para reaplicar a proteção.');
}));
$('reset').addEventListener('click', () => run(async () => {
  if (!window.confirm('Restaurar as opções padrão? As listas de sites pausados e de reparo automático serão apagadas.')) return;
  await request({type:'APPLY_BACKUP',text:JSON.stringify(T.createBackup(C.normalizeConfig(),T.normalize(),api.runtime.getManifest().version))});
  clearImport(); tell('Padrões restaurados. Recarregue páginas abertas para reaplicar a proteção.');
}));
api.storage.onChanged.addListener((changes,area) => {
  if (area !== 'local' || busy) return;
  if (changes.preferences) preferences = T.normalize(changes.preferences.newValue);
  if (changes.config) refresh().catch(error => tell(error.message,true));
  else if (changes.preferences) render();
});
(async () => {
  try { $('version').textContent = api.runtime.getManifest().version; await refresh(); tell('Suas preferências ficam apenas neste navegador.'); }
  catch (error) { tell(error.message,true); render(); }
})();
