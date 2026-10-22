import {chromium} from 'playwright';import fs from 'node:fs';import {spawn} from 'node:child_process';import {runScenarios} from './scenarios.mjs';
const port=8181,server=spawn(process.execPath,['scripts/serve.mjs','.',String(port)],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let browser;const reports=[];
try{for(let i=0;i<40;i++){try{if((await fetch(`http://localhost:${port}`)).ok)break;}catch{}await delay(100);}
browser=await chromium.launch({headless:true,...(process.env.PW_CHANNEL?{channel:process.env.PW_CHANNEL}:{})});
for(const opts of [{label:'desktop',width:1440,height:900},{label:'tablet',width:1024,height:768,touch:true}])reports.push(await runScenarios(browser,`http://localhost:${port}/`,opts));
const ctx=await browser.newContext({viewport:{width:1180,height:820},hasTouch:true});const p=await ctx.newPage();await p.goto(`http://localhost:${port}`);await p.locator('[data-task="D"]').tap();await p.screenshot({path:'docs/screenshots/tablet-1180.png',fullPage:true});if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('1180px overflow');await ctx.close();
}catch(e){reports.push({status:'FAIL',error:e.message,results:e.results});process.exitCode=1;console.error(e);}finally{if(browser)await browser.close();server.kill();fs.writeFileSync('tests/e2e/results.json',JSON.stringify({date:new Date().toISOString(),reports},null,2));}
