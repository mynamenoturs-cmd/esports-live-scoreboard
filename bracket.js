import './series-style-loader.js?v=series1';
import { loadTournamentBundle, subscribeTournament, applyRealtimeChange, filterBundle, gameFromLocation } from './data.js';
import { bracketHtml, gameTabsHtml } from './ui.js?v=series1';
let sub,root,selectedCode;
function paint(){const b=filterBundle(root,selectedCode);if(!b.activeGame)return;selectedCode=b.activeGame.code;document.querySelector('#name').textContent=`${root.tournament.name} · ${b.activeGame.name}`;document.querySelector('#game-tabs').innerHTML=gameTabsHtml(root,selectedCode);document.querySelector('#bracket').innerHTML=bracketHtml(b)}
function selectGame(code){selectedCode=code;const u=new URL(location.href);u.searchParams.set('game',code);history.replaceState({},'',u);paint()}
async function boot(){try{root=await loadTournamentBundle();selectedCode=gameFromLocation(root)?.code;paint();if(!root.demo&&!sub)sub=subscribeTournament(root.tournament.id,p=>{applyRealtimeChange(root,p);paint()})}catch(e){document.querySelector('#bracket').innerHTML=`<div class="notice error">${e.message}</div>`}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-game]');if(b)selectGame(b.dataset.game)});
boot();
