const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require(process.env.ESBUILD_PATH || 'esbuild');
const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
const code = esbuild.transformSync(fs.readFileSync(path.resolve(__dirname, '../stream-deck/src/updates.ts'), 'utf8'), {loader:'ts',format:'cjs',target:'node24'}).code;
function fixture(saved = {}, installed = '0.1.4.0') {
    let clock = 1800000000000, id = 0, settings = structuredClone(saved), network = null, writeFails = false;
    const timers = new Map(), requests = [], writes = [];
    const timer = (fn, delay) => { const key = ++id; timers.set(key, {fn,at:clock+delay}); return key; };
    const context = {module:{exports:{}},exports:{},AbortController,Date:class extends Date{static now(){return clock;}},
        setTimeout:timer,clearTimeout:key=>timers.delete(key)};
    vm.runInNewContext(code, context);
    const api = context.module.exports;
    const service = new api.CompanionUpdates(installed, {
        readSettings: async () => structuredClone(settings),
        writeSettings: async value => { writes.push(JSON.parse(JSON.stringify(value))); if(writeFails) throw Error('write'); settings=structuredClone(value); },
        request: async (url,options) => {requests.push({url,options}); return network(url,options);}
    });
    const digest = 'a'.repeat(64), name=api.INSTALLER_NAME;
    const metadata = (version='0.1.5.0',tag='v0.2.8')=>({schemaVersion:1,pluginUUID:api.PLUGIN_UUID,releaseTag:tag,installer:name,version,sha256:digest,size:123});
    const release = (tag='v0.2.8')=>({tag_name:tag,draft:false,prerelease:true,assets:[{name:api.UPDATE_DESCRIPTOR,state:'uploaded',size:400},{name,state:'uploaded',size:123,digest:'sha256:'+digest}],html_url:'https://evil.invalid',body:'untrusted'});
    let releases=[release()], descriptor=metadata();
    network = async url=>({ok:true,status:200,json:async()=>releases,text:async()=>JSON.stringify(descriptor)});
    async function tick(ms){clock+=ms;for(let round=0;round<10;round++){const due=[...timers].filter(([,t])=>t.at<=clock);if(!due.length)break;for(const [key,t]of due){if(timers.delete(key))t.fn();}await flush();}}
    return {api,service,requests,writes,timers,metadata,release,tick,flush,get saved(){return settings;},get now(){return clock;},set releases(v){releases=v;},set descriptor(v){descriptor=v;},set network(v){network=v;},set writeFails(v){writeFails=v;}};
}
async function run(){
    let checks=0;
    const f=fixture({otherPreference:'retained'}),s=f.service;
    assert.equal(f.api.compareCompanionVersions('0.1.10.0','0.1.9.9'),1);checks++;
    assert.equal(f.api.compareCompanionVersions('0.1.4.1','0.1.4.0'),1);checks++;
    for(const bad of ['0.1.4','v0.1.4.0','0.01.4.0','0.1.4.-1','0.1.4.0-beta','0.1000000000.0.0'])assert.equal(f.api.compareCompanionVersions(bad,'0.1.4.0'),null);checks++;
    await s.initialize();assert.equal(s.getView().initialized,true);assert.equal(f.requests.length,0);checks++;
    const copy=s.getView();copy.installedVersion='bad';assert.equal(s.getView().installedVersion,'0.1.4.0');checks++;
    await s.check();assert.equal(s.getView().status,'available');assert.equal(s.getView().latestVersion,'0.1.5.0');checks++;
    assert.equal(s.getView().downloadUrl,'https://github.com/Sheixo/ShortcutToggle/releases/download/v0.2.8/'+f.api.INSTALLER_NAME);assert.equal(s.getView().releaseUrl,'https://github.com/Sheixo/ShortcutToggle/releases/tag/v0.2.8');checks++;
    assert.equal(f.saved.otherPreference,'retained');assert.equal(f.saved.companionUpdates.latestVersion,'0.1.5.0');checks++;
    assert.equal(f.requests.every(r=>r.options.credentials==='omit'&&r.options.signal instanceof AbortSignal),true);checks++;
    const before=f.requests.length;await f.tick(20000);assert.equal(f.requests.length,before);checks++;
    await s.setAutomaticChecks(false);assert.equal(f.saved.companionUpdates.automaticChecks,false);assert.equal(f.timers.size,0);checks++;
    await s.check();assert.equal(f.requests.length,before+2);checks++;
    const restarted=fixture(f.saved);await restarted.service.initialize();assert.equal(restarted.service.getView().status,'available');assert.equal(restarted.service.getView().automaticChecks,false);assert.equal(restarted.requests.length,0);checks++;
    f.descriptor=f.metadata('0.1.4.0');await s.check();assert.equal(s.getView().status,'current');assert.equal(s.getView().downloadUrl,'');checks++;
    f.descriptor=f.metadata('0.1.3.0');await s.check();assert.equal(s.getView().status,'current');checks++;
    f.network=async()=>({ok:false,status:429});await s.check();assert.equal(s.getView().status,'error');assert.equal(s.getView().lastCheckedAt,f.now);checks++;
    const bad=fixture();bad.releases=[{...bad.release(),draft:true}, {...bad.release(),tag_name:'../../evil'}, {...bad.release(),assets:[]}];await bad.service.check();assert.equal(bad.service.getView().status,'error');assert.equal(bad.requests.length,1);checks++;
    for(const change of [{pluginUUID:'wrong'},{releaseTag:'v999.0.0'},{sha256:'bad'},{size:999},{installer:'evil.exe'},{schemaVersion:2},{version:'0.1.4' }]){
        const invalid=fixture();invalid.descriptor={...invalid.metadata(),...change};await invalid.service.check();assert.equal(invalid.service.getView().status,'error');assert.equal(invalid.service.getView().downloadUrl,'');invalid.service.stop();checks++;
    }
    const two=fixture();
    const releaseData=[two.release('v0.2.9'),two.release('v0.2.8')];two.network=async url=>url.includes('api.github')?{ok:true,json:async()=>releaseData}:{ok:true,text:async()=>JSON.stringify(two.metadata(url.includes('v0.2.8')?'0.1.6.0':'0.1.5.0',url.includes('v0.2.8')?'v0.2.8':'v0.2.9'))};
    await two.service.check();assert.equal(two.service.getView().latestVersion,'0.1.6.0');checks++;
    const stalled=fixture();stalled.network=(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
    const a=stalled.service.check(),b=stalled.service.check();await flush();assert.equal(stalled.requests.length,1);await stalled.tick(10000);await Promise.all([a,b]);assert.equal(stalled.service.getView().status,'error');checks++;
    const cancel=fixture();let resolveRequest;cancel.network=()=>new Promise(resolve=>resolveRequest=resolve);const checking=cancel.service.check();await flush();await cancel.service.setAutomaticChecks(false);resolveRequest({ok:true,json:async()=>[]});await checking;assert.equal(cancel.service.getView().status,'idle');assert.equal(cancel.service.getView().lastCheckedAt,0);checks++;
    const stop=fixture();let stoppedReply;stop.network=()=>new Promise(resolve=>stoppedReply=resolve);const pending=stop.service.check();await flush();stop.service.stop();stoppedReply({ok:true,json:async()=>[]});await pending;assert.equal(stop.writes.length,0);assert.equal(stop.timers.size,0);checks++;
    const retry=fixture();await retry.service.check();retry.network=async()=>({ok:false});await retry.service.check();const retryBefore=retry.requests.length;await retry.tick(3600000);assert.equal(retry.requests.length,retryBefore+1);checks++;
    const write=fixture();await write.service.initialize();write.writeFails=true;await write.service.setAutomaticChecks(false);assert.equal(write.service.getView().automaticChecks,true);assert.match(write.service.getView().message,/non enregistrée/);checks++;
    for(const item of [f,restarted,bad,two,stalled,cancel,retry,write])item.service.stop();
    const init=fixture();let settingsReply;const stalledSettings=new init.api.CompanionUpdates('0.1.4.0',{readSettings:()=>new Promise(resolve=>settingsReply=resolve),writeSettings:async()=>{},request:async()=>{throw Error('unexpected');}});
    const loading=stalledSettings.initialize();await init.tick(10000);await assert.rejects(loading,/timed out/);settingsReply({companionUpdates:{automaticChecks:false}});await flush();assert.equal(stalledSettings.getView().initialized,false);stalledSettings.stop();checks++;
    checks+=testInspector();
    checks+=await testWiring();
    console.log(`${checks} companion update/settings/protocol checks passed.`);
    return checks;
}
async function testWiring(){
    let checks=0;const callbacks={},sent=[],opened=[],writes=[];
    const sdk={info:{plugin:{version:'0.1.4.0'}},settings:{getGlobalSettings:async()=>({companionUpdates:{automaticChecks:false}}),setGlobalSettings:async value=>writes.push(value)},
        ui:{action:{manifestId:'fr.ethan.discord-shortcuts.toggle'},sendToPropertyInspector:async value=>sent.push(value),onDidAppear:cb=>callbacks.appear=cb,onSendToPlugin:cb=>callbacks.send=cb},
        system:{openUrl:async url=>opened.push(url)},logger:{warn(){}}};
    const serviceModule={module:{exports:{}},exports:{},AbortController,Date,setTimeout,clearTimeout};vm.runInNewContext(code,serviceModule);
    const context={module:{exports:{}},exports:{},fetch:async()=>{throw Error('network');},process:{once(){}},require(name){if(name==='@elgato/streamdeck')return {__esModule:true,default:sdk};if(name==='./bridge')return{getState:()=>({connected:true,disabled:false,busy:false}),subscribe:cb=>callbacks.bridge=cb};if(name==='./updates')return serviceModule.module.exports;throw Error(name);}};
    const source=fs.readFileSync(path.resolve(__dirname,'../stream-deck/src/inspector.ts'),'utf8');vm.runInNewContext(esbuild.transformSync(source,{loader:'ts',format:'cjs'}).code,context);
    context.module.exports.initializeInspector();await context.module.exports.startCompanionUpdates();await flush();assert.equal(sent.at(-1).updates.installedVersion,'0.1.4.0');assert.equal(sent.at(-1).connection.connected,true);checks++;
    callbacks.send({action:sdk.ui.action,payload:{type:'openLink',link:'installation',url:'https://evil.invalid'}});await flush();assert.equal(opened[0],'https://github.com/Sheixo/ShortcutToggle/blob/main/docs/STREAM_DECK.fr.md');checks++;
    callbacks.send({action:sdk.ui.action,payload:{type:'openLink',link:'https://evil.invalid'}});callbacks.send({action:{manifestId:'other'},payload:{type:'openLink',link:'github'}});await flush();assert.equal(opened.length,1);checks++;
    callbacks.send({action:sdk.ui.action,payload:{type:'setAutomaticChecks',enabled:'false'}});await flush();assert.equal(writes.length,0);checks++;
    callbacks.send({action:sdk.ui.action,payload:{type:'setAutomaticChecks',enabled:false}});await flush();assert.equal(writes.at(-1).companionUpdates.automaticChecks,false);checks++;
    callbacks.send({action:sdk.ui.action,payload:{type:'checkCompanionUpdates'}});await flush();assert.equal(sent.at(-1).updates.status,'error');checks++;
    return checks;
}
function testInspector(){
    let checks=0;const elements=new Map();for(const id of ['connection','version','check','automatic','update-status','checked-at','download-row','download','release'])elements.set(id,{textContent:'',disabled:true,checked:false,hidden:true,handlers:{},addEventListener(type,cb){this.handlers[type]=cb;}});
    const links=['github','installation','support'].map(link=>({dataset:{link},handlers:{},addEventListener(type,cb){this.handlers[type]=cb;}}));
    const sockets=[];class Socket{static OPEN=1;readyState=1;packets=[];constructor(url){this.url=url;sockets.push(this);}send(text){this.packets.push(JSON.parse(text));}close(){this.readyState=3;}}
    const window={},context={window,document:{getElementById:id=>elements.get(id),querySelectorAll:()=>links},WebSocket:Socket};
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../stream-deck/fr.ethan.discord-shortcuts.sdPlugin/ui/settings.js'),'utf8'),context);
    const connect=window.connectElgatoStreamDeckSocket;
    connect('12345','ui-id','registerPropertyInspector',JSON.stringify({plugin:{version:'0.1.4.0'}}),JSON.stringify({action:'fr.ethan.discord-shortcuts.toggle',context:'key-id'}));sockets[0].onopen();
    assert.equal(sockets[0].url,'ws://127.0.0.1:12345');assert.equal(sockets[0].packets[0].event,'registerPropertyInspector');assert.equal(sockets[0].packets[1].payload.type,'getCompanionSettings');checks++;
    const update={installedVersion:'0.1.4.0',initialized:true,status:'available',automaticChecks:false,message:'Version disponible',lastCheckedAt:1800000000000,downloadUrl:'https://ignored.invalid'};
    const message={event:'sendToPropertyInspector',context:'key-id',payload:{type:'companionSettings',updates:update,connection:{connected:true,disabled:true}}};sockets[0].onmessage({data:JSON.stringify(message)});
    assert.equal(elements.get('connection').textContent,'OFF');assert.equal(elements.get('automatic').checked,false);assert.equal(elements.get('download-row').hidden,false);checks++;
    elements.get('download').handlers.click();assert.deepEqual(sockets[0].packets.at(-1).payload,{type:'openLink',link:'download'});assert.equal(JSON.stringify(sockets[0].packets).includes('ignored.invalid'),false);checks++;
    elements.get('automatic').checked=true;elements.get('automatic').handlers.change();assert.equal(sockets[0].packets.at(-1).payload.enabled,true);checks++;
    message.payload.updates={...update,status:'checking'};sockets[0].onmessage({data:JSON.stringify(message)});assert.equal(elements.get('check').disabled,true);checks++;
    message.payload.updates={...update,initialized:false,status:'error'};sockets[0].onmessage({data:JSON.stringify(message)});assert.equal(elements.get('check').disabled,false);assert.equal(elements.get('automatic').disabled,true);checks++;
    elements.get('check').handlers.click();assert.equal(sockets[0].packets.at(-1).payload.type,'checkCompanionUpdates');checks++;
    links[1].handlers.click({preventDefault(){}});assert.equal(sockets[0].packets.at(-1).payload.link,'installation');checks++;
    const version=elements.get('version').textContent;sockets[0].onmessage({data:'invalid'});message.context='other-key';message.payload.updates.installedVersion='wrong';sockets[0].onmessage({data:JSON.stringify(message)});assert.equal(elements.get('version').textContent,version);checks++;
    sockets[0].onclose();assert.equal(elements.get('download-row').hidden,true);assert.equal(elements.get('check').disabled,true);checks++;
    const count=sockets.length;connect('99999','ui','registerPropertyInspector','{}','{}');assert.equal(sockets.length,count);checks++;
    return checks;
}
module.exports=run;
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
