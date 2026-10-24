const {JSDOM} = require(process.env.JSDOM_MODULE || 'jsdom');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const settle = () => new Promise(resolve => setTimeout(resolve,0));
async function setup(url='https://oasis.test/') {
 const dom = new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url,runScripts:'outside-only'});
 const w=dom.window, d=w.document, state={profiles:new Map(),writes:0,sent:0,user:null};
 const api={
  isEmailLink:url=>url.includes('oobCode='),
  async sendLink(){state.sent++;},
  async finishLink(email){if(state.expired)throw {code:'auth/expired-action-code'};await state.login(email);return {user:state.user};},
  watchUser(cb){state.watch=cb;cb(state.user);},
  async logout(){state.user=null;await state.watch(null);},
  async getProfile(user){if(state.failRead)throw {code:'permission-denied'};return state.profiles.get(user.uid)||null;},
  async createProfile(user,fields){if(state.failSave)throw {code:'unavailable'};if(!state.profiles.has(user.uid)){state.profiles.set(user.uid,{...fields,email:user.email});state.writes++;}return state.profiles.get(user.uid);}
 };
 state.login=async(email='ari@example.com',uid='one')=>{state.user={uid,email,emailVerified:true};await state.watch(state.user);};
 w.eval(fs.readFileSync(path.join(root,'booking.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(root,'customer-ui.js'),'utf8').replace('export function mountCustomers','window.mountCustomers = function'));
 w.mountCustomers(api);
 const el=id=>d.getElementById(id);
 const submit=async id=>{el(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();};
 return {w,d,el,state,submit};
}
(async()=>{
 let {w,el,state,submit}=await setup();
 el('customer-new').click();el('customer-email').value='ari@example.com';await submit('customer-access');
 assert.equal(state.sent,1);assert.equal(el('customer-profile').hidden,true);
 await state.login();assert.equal(el('customer-profile').hidden,false);
 el('customer-name').value='Ari';el('customer-phone').value='1122334455';
 state.failSave=true;await submit('customer-profile');assert.equal(state.writes,0);assert.equal(el('customer-ready').hidden,true);
 state.failSave=false;await submit('customer-profile');assert.equal(state.writes,1);assert.equal(el('nombre').value,'Ari');assert.equal(el('customer-ready').hidden,false);
 assert.equal(el('booking').querySelector('button').disabled,true);
 el('customer-signout').click();await settle();assert.equal(el('nombre').value,'');assert.equal(el('clienteEmail').value,'');assert.equal(el('customer-ready').hidden,true);
 await state.login();assert.equal(el('customer-profile').hidden,true);assert.equal(el('customer-ready').hidden,false);assert.equal(state.writes,1);
 await state.login('other@example.com','two');assert.equal(el('customer-profile').hidden,false);assert.equal(el('nombre').value,'');
 state.failRead=true;await state.login();assert.equal(el('customer-retry').hidden,false);assert.equal(el('customer-ready').hidden,true);
 state.failRead=false;el('customer-retry').click();await settle();assert.equal(el('customer-ready').hidden,false);
 w.close();
 ({w,el,state,submit}=await setup('https://oasis.test/?oobCode=expired'));
 state.expired=true;el('customer-email').value='ari@example.com';await submit('customer-access');assert.match(el('customer-send').textContent,/nuevo/);assert.equal(w.location.search,'');
 await submit('customer-access');assert.equal(state.sent,1);w.close();
 ({w,el,state,submit}=await setup('https://oasis.test/?oobCode=valid'));
 // An old signed-in account must not hide the link confirmation form.
 await state.login('old@example.com','old');assert.equal(el('customer-access').hidden,false);
 el('customer-email').value='ari@example.com';await submit('customer-access');assert.equal(el('customer-profile').hidden,false);assert.equal(el('customer-session-email').textContent,'ari@example.com');assert.equal(w.location.search,'');w.close();
 console.log('PASS: new/existing customer, verified link, expired link and resend, read/write failure, retry, logout, account switch, old-session link, disabled booking. Mock Firebase; no cloud writes.');
})().catch(error=>{console.error(error);process.exit(1);});
