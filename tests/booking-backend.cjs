const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync('calendar-backend/Code.gs','utf8');
function setup(identity={localId:'ari',email:'ari@example.com',emailVerified:true}) {
 const state={identity,fetches:0,calendarReads:0,events:[],released:0,locked:true,lookupStatus:200};
 const calendar={getEvents(){return state.events;},createEvent(title,start,end,opts){state.events.push({getDescription:()=>opts.description});state.created={title,start,end,...opts};}};
 const context=vm.createContext({console,Date,HtmlService:{createHtmlOutput:s=>s},
  UrlFetchApp:{fetch(url,opts){state.fetches++;state.lookup=JSON.parse(opts.payload);if(state.lookupError)throw Error('offline');return {getResponseCode:()=>state.lookupStatus,getContentText:()=>JSON.stringify({users:state.identity?[state.identity]:[]})};}},
  LockService:{getScriptLock:()=>({tryLock:()=>state.locked,releaseLock:()=>state.released++})},
  CalendarApp:{getCalendarById(){state.calendarReads++;return calendar;}},
  Utilities:{formatDate(date,tz,format){const local=new Date(date.getTime()-3*3600000);return format==='u'?String(local.getUTCDay()||7):local.toISOString().slice(0,10);}}
 });
 vm.runInContext(source,context);
 context.getSchedule_=()=>({days:[1,2,3,4,5,6,7],openTime:'09:00',closeTime:'18:00'});
 context.getServices_=()=>[{name:'Prueba',durationMin:60}];
 const date=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 const p={idToken:'valid-test-token',clienteUid:'ari',email:'ari@example.com',nombre:'Ari',telefono:'1122334455',servicio:'Prueba',fecha:date,hora:'10:00',requestId:'11111111-1111-4111-8111-111111111111'};
 return {state,context,p,book:extra=>context.doPost({parameter:{...p,...extra}})};
}
let n=0;
for(const identity of [null,{localId:'ari',email:'ari@example.com',emailVerified:false},{localId:'ari',email:'ari@example.com',emailVerified:true,disabled:true},{email:'ari@example.com',emailVerified:true}]){
 const t=setup(identity);assert.match(t.book(),/verificar tu sesión/);assert.equal(t.state.calendarReads,0);n++;
}
for(const extra of [{idToken:''},{idToken:'x'.repeat(10001)},{clienteUid:'other'},{email:'other@example.com'}]){
 const t=setup();assert.match(t.book(extra),/verificar tu sesión/);assert.equal(t.state.calendarReads,0);n++;
}
for(const status of [400,401,500]){const t=setup();t.state.lookupStatus=status;assert.match(t.book(),/verificar tu sesión/);assert.equal(t.state.calendarReads,0);n++;}
{
 const t=setup();t.state.lookupError=true;assert.match(t.book(),/verificar tu sesión/);assert.equal(t.state.calendarReads,0);n++;
}
{
 const t=setup();assert.match(t.book(),/Solicitud registrada/);assert.match(t.state.created.description,/Cliente UID: ari/);assert.match(t.state.created.description,/Cliente email: ari@example.com/);assert.doesNotMatch(t.state.created.description,/valid-test-token/);assert.deepEqual(t.state.lookup,{idToken:'valid-test-token'});assert.equal(t.state.released,1);assert.match(t.book(),/No se creó un turno duplicado/);assert.equal(t.state.events.length,1);n++;
}
{
 const t=setup();t.state.locked=false;assert.match(t.book(),/otra reserva en proceso/);assert.equal(t.state.calendarReads,0);n++;
}
{
 const t=setup();t.state.events.push({getDescription:()=>''});assert.match(t.book(),/horario está ocupado/);assert.equal(t.state.created,undefined);assert.equal(t.state.released,1);n++;
}
{
 const t=setup();assert.equal(t.context.verifyAdmin_('token'),'');t.state.identity={localId:'admin',email:'oasysbeautycenter@gmail.com',emailVerified:true};assert.equal(t.context.verifyAdmin_('token'),'oasysbeautycenter@gmail.com');t.state.identity.emailVerified=false;assert.equal(t.context.verifyAdmin_('token'),'');n++;
}
console.log(`PASS: ${n} backend scenarios: identity, anonymous/forged/unverified/disabled, provider failure, valid reservation, duplicate, occupied slot, lock, admin. Mock services only.`);
