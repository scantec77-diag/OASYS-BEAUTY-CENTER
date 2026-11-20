const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');const fs=require('node:fs');const assert=require('node:assert/strict');
const settle=()=>new Promise(r=>setTimeout(r,0));
(async()=>{
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://oasis.test/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 const state={records:new Map(),writes:0,sends:[],timers:[]};
 w.setTimeout=fn=>{state.timers.push(fn);return state.timers.length;};w.setInterval=()=>0;
 w.HTMLFormElement.prototype.submit=function(){state.sends.push(Object.fromEntries(new w.FormData(this)));};
 w.oasisAdminSession={idToken:'admin-token'};
 w.oasisAdminServices={db:{},auth:{currentUser:{email:'oasysbeautycenter@gmail.com',emailVerified:true}}};
 w.fakeFirebase={
  doc:(_db,c,id)=>c+'/'+id,collection:(_db,c)=>c,where:()=>{},query:c=>c,serverTimestamp:()=> 'server-time',
  getDocsFromServer:async()=>({docs:[]}),addDoc:async()=>{},
  runTransaction:async(_db,fn)=>fn({get:async ref=>({exists:()=>state.records.has(ref),data:()=>state.records.get(ref)}),set:(ref,data)=>{state.records.set(ref,data);state.writes++;}})
 };
 w.eval(fs.readFileSync('statistics.js','utf8').replace(/^import .*from .*;$/m,"const AVAILABILITY_ENDPOINT='https://script.google.com/macros/s/test/exec';").replace("await import('https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js')",'window.fakeFirebase'));
 const frame=d.getElementById('oasis-completed-services-frame');
 const message=data=>w.dispatchEvent(new w.MessageEvent('message',{source:frame.contentWindow,data}));
 const agenda=bookings=>message({type:'oasis-service-agenda',ok:true,data:{counts:{},appointments:[],pendingBookings:bookings}});
 const reference='11111111-1111-4111-8111-111111111111';
 agenda([{reference,customer:'Ari',service:'Prueba',start:'2026-12-01T13:00:00Z',amount:5000,receiptUrl:'https://drive.google.com/file/d/test/view'}]);
 assert.match(d.getElementById('admin-pending-bookings').textContent,/Pendiente de revisar pago/);
 assert.equal(d.querySelector('#admin-pending-bookings a').rel,'noopener noreferrer');
 w.HTMLElement.prototype.scrollIntoView=function(){};
 d.querySelector('#admin-pending-bookings button').click();
 assert.equal(d.getElementById('admin-confirm-deposit-reference').value,reference);
 assert.equal(d.getElementById('admin-confirm-deposit-amount').value,'5000');
 const form=d.getElementById('admin-confirm-deposit-form');
 const send=async()=>{form.dispatchEvent(new w.Event('submit',{cancelable:true}));await settle();await settle();};
 await send();assert.equal(state.writes,1);let request=state.sends.at(-1);assert.equal(request.action,'portalConfirmReceipt');
 const expired=state.timers.at(-1);expired();await send();assert.equal(state.writes,1);let retry=state.sends.at(-1);assert.notEqual(retry.nonce,request.nonce);
 expired(); // An old timeout must not clear the newer operation.
 message({source:'oasys-calendar',nonce:request.nonce,result:{ok:true,notifications:'sent'}});
 assert.equal(d.getElementById('admin-confirm-deposit-reference').value,reference);
 message({source:'oasys-calendar',nonce:retry.nonce,result:{ok:true,notifications:'pending_review'}});
 assert.match(d.getElementById('admin-confirm-deposit-status').textContent,/correos pendientes/);
 assert.equal(d.getElementById('admin-confirm-deposit-reference').value,reference);
 agenda([]); // clear agenda refresh after confirmation
 d.getElementById('admin-confirm-deposit-amount').value='6000';await send();assert.equal(state.writes,1);assert.match(d.getElementById('admin-confirm-deposit-status').textContent,/otros datos/);
 d.getElementById('admin-confirm-deposit-amount').value='5000';await send();request=state.sends.at(-1);
 message({source:'oasys-calendar',nonce:request.nonce,result:{ok:true,notifications:'sent'}});
 assert.match(d.getElementById('admin-confirm-deposit-status').textContent,/Turno tomado en rojo/);
 assert.equal(d.getElementById('admin-confirm-deposit-reference').value,'');
 assert.equal(state.writes,1);
 d.dispatchEvent(new w.CustomEvent('oasis:admin-auth',{detail:null}));assert.equal(d.getElementById('admin-pending-bookings').textContent,'');
 w.close();console.log('PASS: pending review + private receipt link, form fill, ledger transaction, timeout/retry, stale nonce, pending emails, mismatch, success and logout. jsdom; no live payments or emails.');
})().catch(e=>{console.error(e);process.exitCode=1;});
