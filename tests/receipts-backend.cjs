const vm=require('node:vm');const fs=require('node:fs');const assert=require('node:assert/strict');
const reference='11111111-1111-4111-8111-111111111111';
function setup(){
 const state={lookup:200,ledger:200,locked:true,release:0,sent:[],quota:10,props:new Map(),files:[],folders:0,colorCalls:0};
 state.description=`OASIS_REQUEST:${reference}\nCliente: Ari\nCliente email: ari@example.com\nTratamiento: Prueba\nSeña recibida: pendiente de verificar\nEstado: pendiente de confirmación del centro.`;
 const event={getDescription:()=>state.description,setDescription:s=>{state.description=s;},getTitle:()=>state.title||'Turno web · Prueba',setTitle:s=>{state.title=s;},setColor:c=>{state.colorCalls++;if(state.colorFail)throw Error('calendar');state.color=c;},getStartTime:()=>new Date('2026-12-01T13:00:00Z'),getEndTime:()=>new Date('2026-12-01T14:00:00Z'),getId:()=>reference};
 state.events=[event];
 const folder={getId:()=> 'folder-test',getFilesByName:name=>{const matches=state.files.filter(f=>f.name===name);let i=0;return {hasNext:()=>i<matches.length,next:()=>matches[i++]};},createFile:blob=>{const file={name:blob.name,getDescription:()=>file.description,setDescription:s=>{file.description=s;},getUrl:()=> 'https://drive.google.com/file/d/file-test/view'};state.files.push(file);return file;}};
 const context=vm.createContext({console,Date,
  HtmlService:{createHtmlOutput:s=>s},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>state.props.get(k)||null,setProperty:(k,v)=>state.props.set(k,v)})},
  LockService:{getScriptLock:()=>({tryLock:()=>state.locked,releaseLock:()=>state.release++})},
  CalendarApp:{getCalendarById:()=>({getEvents:()=>state.events}),EventColor:{RED:'11'}},
  Utilities:{formatDate:()=> '01/12/2026 10:00',base64Decode:s=>[...Buffer.from(s,'base64')],newBlob:(bytes,type,name)=>({bytes,type,name})},
  DriveApp:{createFolder:()=>{state.folders++;return folder;},getFolderById:()=>folder},
  MailApp:{getRemainingDailyQuota:()=>state.quota,sendEmail:mail=>{if(state.mailFail===mail.to)throw Error('mail uncertain');state.sent.push(mail);}},
  UrlFetchApp:{fetch:(url,opts)=>url.includes('identitytoolkit')?{getResponseCode:()=>state.lookup,getContentText:()=>JSON.stringify({users:[{localId:'admin',email:'oasysbeautycenter@gmail.com',emailVerified:true}]})}:{getResponseCode:()=>state.ledger,getContentText:()=>JSON.stringify({fields:{referencia:{stringValue:reference},cliente:{stringValue:'Ari'},monto:{integerValue:'5000'},amount:{integerValue:'5000'}}})}}
 });
 vm.runInContext(fs.readFileSync('calendar-backend/Code.gs','utf8'),context);
 const params={action:'portalConfirmReceipt',idToken:'admin-test-token',requestId:reference,customerName:'Ari',amount:'5000',nonce:'test-nonce'};
 return {state,context,params,approve:extra=>context.handleAdminPost_({parameter:{...params,...extra}})};
}
let n=0;
{
 const t=setup();const result=t.approve();assert.match(result,/"ok":true/);assert.match(result,/"notifications":"sent"/);assert.equal(t.state.color,'11');assert.equal(t.state.title,'Turno tomado · Prueba');assert.equal(t.context.getEventStatus_(t.state.title),'taken');assert.equal(t.state.sent.length,2);assert.equal(t.state.sent[0].to,'ari@example.com');assert.equal(t.state.sent[1].to,'oasysbeautycenter@gmail.com');assert.match(t.state.sent[0].body,/01\/12\/2026 10:00/);t.approve();assert.equal(t.state.sent.length,2);assert.equal(t.state.description.split('OASIS_DEPOSIT_CONFIRMED:').length,2);n++;
}
for(const [change,reason] of [[{requestId:'bad'},'invalid_reference'],[{amount:'6000'},'deposit_record_mismatch'],[{customerName:'Other'},'deposit_record_mismatch']]){const t=setup();assert.match(t.approve(change),new RegExp(reason));assert.equal(t.state.colorCalls,0);assert.equal(t.state.sent.length,0);n++;}
for(const status of [403,404,500]){const t=setup();t.state.ledger=status;assert.match(t.approve(),/deposit_record_unavailable/);assert.equal(t.state.sent.length,0);n++;}
{
 const t=setup();t.state.lookup=401;assert.match(t.approve(),/unauthorized/);assert.equal(t.state.colorCalls,0);n++;
}
{
 const t=setup();t.state.locked=false;assert.match(t.approve(),/busy/);assert.equal(t.state.sent.length,0);n++;
}
{
 const t=setup();t.state.events=[];assert.match(t.approve(),/reservation_not_found/);assert.equal(t.state.sent.length,0);n++;
}
{
 const t=setup();t.state.events.push(t.state.events[0]);assert.match(t.approve(),/ambiguous_reference/);n++;
}
{
 const t=setup();t.state.description=t.state.description.replace('Cliente: Ari','Cliente: Other');assert.match(t.approve(),/customer_mismatch/);n++;
}
{
 const t=setup();t.state.colorFail=true;assert.match(t.approve(),/confirmation_failed/);assert.equal(t.state.sent.length,0);t.state.colorFail=false;t.approve();assert.equal(t.state.sent.length,2);n++;
}
{
 const t=setup();t.state.quota=0;assert.match(t.approve(),/pending_review/);assert.equal(t.state.sent.length,0);t.state.quota=10;t.approve();assert.equal(t.state.sent.length,2);n++;
}
{
 const t=setup();t.state.mailFail='ari@example.com';assert.match(t.approve(),/pending_review/);assert.equal(t.state.sent.length,1);t.state.mailFail='';t.approve();assert.equal(t.state.sent.length,1);assert.match(t.state.props.get('OASIS_CONFIRM_EMAILS_'+reference),/uncertain/);n++;
}
{
 const t=setup();t.state.description=t.state.description.replace('Cliente email: ari@example.com','Cliente email: ');assert.match(t.approve(),/pending_review/);assert.equal(t.state.sent.length,1);n++;
}
{
 const t=setup();const image='data:image/jpeg;base64,'+Buffer.from([255,216,255,217]).toString('base64');assert.match(t.context.saveReceipt_(image,reference,'ari'),/drive.google.com/);t.context.saveReceipt_(image,reference,'ari');assert.equal(t.state.files.length,1);assert.equal(t.state.folders,1);assert.throws(()=>t.context.saveReceipt_(image,reference,'other'),/receipt_conflict/);assert.throws(()=>t.context.saveReceipt_('data:image/jpeg;base64,YmFk',reference,'ari'),/invalid_receipt/);assert.throws(()=>t.context.saveReceipt_('data:text/html;base64,AAAA',reference,'ari'),/invalid_receipt/);assert.equal(t.context.saveReceipt_('',reference,'ari'),'');n++;
}
{
 const t=setup();assert.equal(t.context.getRequestedDepositAmount_(),5000);t.state.ledger=500;assert.ok(Number.isNaN(t.context.getRequestedDepositAmount_()));n++;
}
console.log(`PASS: ${n} receipt/approval scenarios: admin auth, ledger checks, conflicts, red taken state, both emails, retries, quota, uncertain sends, private Drive image validation/reuse and server deposit amount. No real files or emails.`);
