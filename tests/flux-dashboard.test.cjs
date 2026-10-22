const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dashboard = require('../js/flux-dashboard.js');
const root = path.join(__dirname, '..');

test('recent additions follow catalog append order without modifying the catalog', () => {
  const games = Array.from({length:7}, (_,i) => ({name:'Game '+i,file:'g'+i}));
  assert.deepEqual(dashboard.recentGames(games).map(game=>game.name), ['Game 6','Game 5','Game 4','Game 3','Game 2']);
  assert.equal(games[0].name,'Game 0');
});

test('hot games use only genuine counts for known catalog items', () => {
  const games = [{name:'A',file:'a'},{name:'B',file:'b'}];
  const counts = [{id:'b',plays:2},{id:'a',plays:8},{id:'evil',plays:500},{id:'a',plays:999},{id:'b',plays:-1}];
  assert.deepEqual(dashboard.popularGames(games,counts).map(item=>[item.game.name,item.plays]),[['A',8],['B',2]]);
  assert.deepEqual(dashboard.popularGames(games,[]),[]);
});

test('new labels compare the current catalog with its saved baseline and stat ids are path-safe', () => {
  const games = [{name:'Old',file:'Games/old.html'},{name:'New',file:'MultiFile Games\\new\\index.html'}];
  assert.deepEqual(dashboard.newGames(games, ['Games/old.html']).map(game => game.name), ['New']);
  assert.equal(dashboard.statDocumentId('Games/one.html'), 'game_Games_2Fone.html');
  assert.equal(dashboard.statDocumentId('MultiFile Games\\new\\index.html'), 'game_MultiFile_20Games_2Fnew_2Findex.html');
});

test('account label uses authenticated state and the chosen display name', () => {
  assert.equal(dashboard.loginLabel({status:'signed-in',name:'account-name'},{name:'Coral'}),'Logged in as: Coral');
  assert.equal(dashboard.loginLabel({status:'signed-in',name:'account-name'},{}),'Logged in as: account-name');
  assert.equal(dashboard.loginLabel({status:'signed-out'},{name:'Coral'}),'Not signed in');
  assert.equal(dashboard.loginLabel(null,{}),'Checking account…');
});

test('home initializes catalog counts without visiting Games and renders five recent games', () => {
  const events = {};
  function element() { return {children:[],textContent:'',setAttribute(){},addEventListener(){},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;}}; }
  const nodes = Object.fromEntries(['stat-count','home-login-status','home-recent-games','quick-resume-container','home-hot-games'].map(id=>[id,element()]));
  const win = { document:{getElementById:id=>nodes[id],createElement:element},localStorage:{getItem:()=>null},addEventListener:(name,fn)=>events[name]=fn };
  const games = Array.from({length:6},(_,i)=>({name:'Game '+i,file:'g'+i}));
  const app = dashboard.create(win);
  app.start({games,openGame(){},getProfileData:()=>({name:'Coral'})});
  assert.equal(nodes['stat-count'].textContent,'6');
  assert.equal(nodes['home-recent-games'].children.length,5);
  win.fluxAuthState={status:'signed-in',name:'someone'}; events['flux-auth-changed']();
  assert.equal(nodes['home-login-status'].textContent,'Logged in as: Coral');
});

test('dashboard keeps the site navigation and removes the favorites and session counters', () => {
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  const start = html.indexOf('<div id="view-dashboard"');
  const end = html.indexOf('<!-- Movies Streaming View -->',start);
  const home = html.slice(start,end);
  assert.match(home,/id="home-recent-games"/); assert.match(home,/id="home-hot-games"/);
  assert.match(home,/id="home-login-status"/); assert.doesNotMatch(home,/FAVORITED ITEMS|SESSION TIME/);
  assert.match(html,/id="btn-archives"/); assert.match(html,/id="btn-ai"/);
  assert.match(html,/js\/flux-game-catalog-baseline\.js/);
  assert.match(fs.readFileSync(path.join(root, 'js', 'flux-dashboard.js'),'utf8'), /game_statistics/);
});

test('Hot explains why a directly opened file cannot connect', async () => {
  const target = { replaceChildren(...items) { this.children = items; } };
  const win = {
    location: { protocol: 'file:' },
    document: { getElementById: id => id === 'home-hot-games' ? target : null, createElement: () => ({}) },
    fetch: () => { throw Error('must not fetch from a local file'); }
  };
  await dashboard.create(win).loadHot();
  assert.match(target.children[0].textContent, /http:\/\/127\.0\.0\.1:3031\//);
});
