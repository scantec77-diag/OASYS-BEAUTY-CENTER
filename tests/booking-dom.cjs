const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const settle=()=>new Promise(r=>setTimeout(r,0));
async function setup(){
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://oasis.test/',runScripts:'outside-only'});
 const w=dom.window,d=w.document,state={sends:[],tokens:0};
 w.getBookingIdToken=async uid=>{state.tokens++;if(state.fail)throw Error('expired');if(state.onToken)await state.onToken();assert.equal(uid,'ari');return 'test-id-token';};
 w.HTMLFormElement.prototype.submit=function(){state.sends.push(Object.fromEntries(new w.FormData(this)));};
 let code=fs.readFileSync('booking.js','utf8').replace(/^import .*from .*;$/m,"const APPS_SCRIPT_ENDPOINT = 'https://script.google.com/macros/s/test/exec';").replace("await import('./customers.js')",'({getBookingIdToken:window.getBookingIdToken})');
 w.eval(code);
 const form=d.getElementById('booking');
 const emit=detail=>d.dispatchEvent(new w.CustomEvent('oasis:customer',{detail}));
 const customer={uid:'ari',email:'ari@example.com',nombre:'Ari',telefono:'1122334455'};
 const send=async()=>{form.dispatchEvent(new w.Event('submit',{cancelable:true}));await settle();await settle();};
 d.getElementById('servicio').selectedIndex=1;
 d.getElementById('fecha').value=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 d.getElementById('hora').value='10:00';
 return {dom,w,d,state,form,emit,customer,send};
}
(async()=>{
 let t=await setup();await t.send();assert.equal(t.state.sends.length,0);
 t.emit(t.customer);await t.send();assert.equal(t.state.sends.length,1);
 let sent=t.state.sends[0];assert.equal(sent.idToken,'test-id-token');assert.equal(sent.email,'ari@example.com');assert.equal(sent.clienteUid,'ari');assert.match(sent.requestId,/^[a-f0-9-]{36}$/i);
 assert.equal(t.form.querySelector('[name=idToken]').value,'');
 await t.send();assert.equal(t.state.sends.length,2);assert.equal(t.state.tokens,2);assert.equal(t.state.sends[1].requestId,sent.requestId);
 t.emit(null);await t.send();assert.equal(t.state.sends.length,2);t.dom.window.close();
 t=await setup();t.emit(t.customer);t.state.fail=true;await t.send();assert.equal(t.state.sends.length,0);assert.match(t.d.getElementById('resultado').textContent,/no se envió/);t.dom.window.close();
 t=await setup();t.emit(t.customer);t.state.onToken=()=>t.emit({...t.customer,uid:'other'});await t.send();assert.equal(t.state.sends.length,0);t.dom.window.close();
 t=await setup();t.emit(t.customer);let resume;t.state.onToken=()=>new Promise(r=>{resume=r;});const first=t.send();await settle();await t.send();assert.equal(t.state.tokens,1);resume();await first;await settle();assert.equal(t.state.sends.length,1);t.dom.window.close();
 for(const url of ['https://oasis.test/','https://oasis.test/?vista=demo']){
  const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url,runScripts:'outside-only'});
  dom.window.eval(fs.readFileSync('header-widgets.js','utf8').replace(/^import .*from .*;$/m,"const APPS_SCRIPT_ENDPOINT = '';"));dom.window.close();
 }
 console.log('PASS: form serializes token + actual email field, refresh on retry, stable reference, logout, failed token, account switch, duplicate submit; absent weather markup including demo. jsdom; no live requests.');
})().catch(e=>{console.error(e);process.exitCode=1;});
