const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true});
 const page = await browser.newPage({viewport:{width:390,height:844}});
 const base = path.resolve(__dirname,'..');
 await page.route('**/*', async route => {
  const u = new URL(route.request().url());
  if (u.hostname !== 'oasis.test') return route.abort();
  if (u.pathname === '/customer-config.js') return route.fulfill({contentType:'text/javascript',body:'export const CUSTOMERS_ENABLED = true;'});
  if (u.pathname === '/customers.js') return route.fulfill({contentType:'text/javascript', body:`
   import {mountCustomers} from './customer-ui.js';
   const profiles = new Map();
   window.test = { failRead:false, failSave:false, expired:false, sent:0, writes:0,
    login(email='ari@example.com',uid='one') { this.user={uid,email,emailVerified:true}; return this.watch(this.user); },
    logout(){this.user=null;return this.watch(null);},
    async emitSaved(){profiles.set('one',{nombre:'Ari',telefono:'1122334455',email:'ari@example.com'});await this.login();}
   };
   mountCustomers({
    isEmailLink:url=>url.includes('oobCode='),
    sendLink:async()=>{window.test.sent++;},
    finishLink:async(email)=>{if(window.test.expired) throw {code:'auth/expired-action-code'};await window.test.login(email);return {user:window.test.user};},
    watchUser:cb=>{window.test.watch=cb;cb(null);},
    logout:()=>window.test.logout(),
    getProfile:async user=>{if(window.test.failRead) throw {code:'permission-denied'}; return profiles.get(user.uid)||null;},
    createProfile:async(user,data)=>{if(window.test.failSave) throw {code:'unavailable'};if(!profiles.has(user.uid)){profiles.set(user.uid,{...data,email:user.email});window.test.writes++;}return profiles.get(user.uid);}
   });`});
  const name = u.pathname === '/' ? 'index.html' : u.pathname.slice(1);
  const file = path.join(base,name);
  if (!fs.existsSync(file)) return route.abort();
  await route.fulfill({body:fs.readFileSync(file),contentType:name.endsWith('.js')?'text/javascript':'text/html'});
 });
 const visible = selector=>page.locator(selector).isVisible();
 await page.goto('https://oasis.test/');
 await page.waitForFunction(()=>window.test);
 await page.locator('#customer-new').click();
 await page.locator('#customer-email').fill('ari@example.com');
 await page.locator('#customer-send').click();
 assert.equal(await page.evaluate(()=>window.test.sent),1);
 assert.equal(await visible('#customer-profile'),false);
 await page.evaluate(()=>window.test.login());
 assert.equal(await visible('#customer-profile'),true);
 await page.locator('#customer-name').fill('Ari');
 await page.locator('#customer-phone').fill('1122334455');
 await page.evaluate(()=>window.test.failSave=true);
 await page.locator('#customer-save').click();
 assert.equal(await visible('#customer-ready'),false);
 assert.equal(await page.evaluate(()=>window.test.writes),0);
 await page.evaluate(()=>window.test.failSave=false);
 await page.locator('#customer-save').click();
 await page.waitForFunction(()=>!document.getElementById('customer-ready').hidden);
 assert.equal(await page.locator('#nombre').inputValue(),'Ari');
 assert.equal(await page.evaluate(()=>window.test.writes),1);
 assert.equal(await page.locator('#booking button[type=submit]').isDisabled(),true);
 await page.locator('#customer-signout').click();
 assert.equal(await page.locator('#nombre').inputValue(),'');
 assert.equal(await visible('#customer-ready'),false);
 await page.evaluate(()=>window.test.login());
 assert.equal(await visible('#customer-profile'),false);
 assert.equal(await visible('#customer-ready'),true);
 assert.equal(await page.evaluate(()=>window.test.writes),1);
 await page.evaluate(()=>window.test.login('other@example.com','two'));
 assert.equal(await visible('#customer-profile'),true);
 assert.equal(await page.locator('#nombre').inputValue(),'');
 await page.evaluate(()=>{window.test.failRead=true;return window.test.login();});
 assert.equal(await visible('#customer-retry'),true);
 assert.equal(await visible('#customer-ready'),false);
 await page.evaluate(()=>window.test.failRead=false);
 await page.locator('#customer-retry').click();
 await page.waitForFunction(()=>!document.getElementById('customer-ready').hidden);
 await page.screenshot({path:process.env.SCREENSHOT_PATH || '/tmp/oasis-customer-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
 await page.goto('https://oasis.test/?oobCode=expired');
 await page.waitForFunction(()=>window.test);
 await page.evaluate(()=>window.test.expired=true);
 await page.locator('#customer-email').fill('ari@example.com');
 await page.locator('#customer-send').click();
 await page.waitForFunction(()=>document.getElementById('customer-send').textContent.includes('nuevo'));
 assert.equal(await page.evaluate(()=>location.search),'');
 await page.locator('#customer-send').click();
 assert.equal(await page.evaluate(()=>window.test.sent),1);
 await page.goto('https://oasis.test/?oobCode=valid');
 await page.waitForFunction(()=>window.test);
 await page.locator('#customer-email').fill('ari@example.com');
 await page.locator('#customer-send').click();
 await page.waitForFunction(()=>!document.getElementById('customer-profile').hidden);
 assert.equal(await page.evaluate(()=>location.search),'');
 console.log('PASS: email link, new profile, existing profile, write error, read error/retry, account isolation, logout, expired link, cross-device link, disabled bookings, mobile layout. Mock Firebase; no live writes or emails.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
