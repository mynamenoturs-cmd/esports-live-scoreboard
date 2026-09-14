export const demoTournament = {
  id: 'demo-tournament', slug: 'esport-championship', name: 'Kejohanan E-Sport',
  venue: 'Arena Utama', starts_at: '2026-09-14T09:00:00+08:00', status: 'live'
};

export const demoGames = [
  {id:'g-fifa',tournament_id:'demo-tournament',code:'fifa',name:'EA SPORTS FC / FIFA',team_size:1,scoring_mode:'goals',default_best_of:1,allow_draws:true,sort_order:1,is_active:true},
  {id:'g-mlbb',tournament_id:'demo-tournament',code:'mlbb',name:'Mobile Legends: Bang Bang',team_size:5,scoring_mode:'series',default_best_of:3,allow_draws:false,sort_order:2,is_active:true}
];

const mlbb=[['m1t','Team Apex','APX'],['m2t','Team Nova','NVA'],['m3t','Cyber Lynx','CLX'],['m4t','Shadow Core','SHD'],['m5t','Titan X','TTX'],['m6t','Frostbyte','FRB'],['m7t','Red Vortex','RVX'],['m8t','Quantum 9','Q9']];
const fifa=[['f1t','Falcon FC','FFC'],['f2t','Pixel United','PXU'],['f3t','Sabah Eleven','S11'],['f4t','Goal Rush','GLR'],['f5t','Neon FC','NFC'],['f6t','Velocity','VEL'],['f7t','Rising XI','RXI'],['f8t','Striker Lab','STL']];
export const demoTeams = [
  ...mlbb.map(([id,name,short_name],i)=>({id,tournament_id:'demo-tournament',game_id:'g-mlbb',name,short_name,seed_order:i+1})),
  ...fifa.map(([id,name,short_name],i)=>({id,tournament_id:'demo-tournament',game_id:'g-fifa',name,short_name,seed_order:i+1}))
];

export const demoMatches = [
  {id:'mm1',tournament_id:'demo-tournament',game_id:'g-mlbb',round_name:'Kumpulan A',stage:'group',team_a_id:'m1t',team_b_id:'m8t',team_a_score:2,team_b_score:0,status:'finished',scheduled_at:'2026-09-14T10:00:00+08:00',best_of:3,winner_id:'m1t'},
  {id:'mm2',tournament_id:'demo-tournament',game_id:'g-mlbb',round_name:'Separuh Akhir',stage:'semifinal',team_a_id:'m1t',team_b_id:'m2t',team_a_score:2,team_b_score:1,status:'live',scheduled_at:'2026-09-14T16:00:00+08:00',best_of:5,winner_id:null},
  {id:'mm3',tournament_id:'demo-tournament',game_id:'g-mlbb',round_name:'Grand Final',stage:'final',team_a_id:null,team_b_id:null,team_a_score:0,team_b_score:0,status:'scheduled',scheduled_at:'2026-09-14T19:00:00+08:00',best_of:5,winner_id:null},
  {id:'fm1',tournament_id:'demo-tournament',game_id:'g-fifa',round_name:'Kumpulan A',stage:'group',team_a_id:'f1t',team_b_id:'f2t',team_a_score:2,team_b_score:2,status:'finished',scheduled_at:'2026-09-14T09:30:00+08:00',best_of:1,winner_id:null},
  {id:'fm2',tournament_id:'demo-tournament',game_id:'g-fifa',round_name:'Separuh Akhir',stage:'semifinal',team_a_id:'f3t',team_b_id:'f4t',team_a_score:1,team_b_score:1,team_a_tiebreak:4,team_b_tiebreak:3,status:'live',scheduled_at:'2026-09-14T15:00:00+08:00',best_of:1,winner_id:null},
  {id:'fm3',tournament_id:'demo-tournament',game_id:'g-fifa',round_name:'Grand Final',stage:'final',team_a_id:null,team_b_id:null,team_a_score:0,team_b_score:0,status:'scheduled',scheduled_at:'2026-09-14T18:00:00+08:00',best_of:1,winner_id:null}
];
