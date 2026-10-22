import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Nur echte DOM-Bedienung. Kein Zugriff auf TL, Sessionzustände oder interne Actions.
export async function runScenarios(browser,base,{touch=false,width=1440,height=900,label='desktop',screens='docs/screenshots',frame=false,offline=false}={}){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
  const results=[],errors=[],external=[];let page,ui;
  context.on('page',p=>{p.on('pageerror',x=>errors.push(x.message));p.on('console',x=>{if(x.type()==='error')errors.push(x.text());});});
  context.on('request',r=>{if(!r.url().startsWith('data:')&&new URL(r.url()).origin!==new URL(base).origin)external.push(r.url());});
  async function fresh(id){
    if(page)await page.close();page=await context.newPage();
    await page.clock.install({time:new Date('2026-10-22T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-22T12:00:01Z'));
    await page.goto(base);ui=frame?page.frameLocator('#sco'):page;
    await ui.locator('[data-category]').waitFor();
    if(id) {if(id.startsWith('K'))await click('[data-category]');else await click(`[data-task="${id}"]`);if(id.startsWith('K')&&id!=='K-01')await click(`#tasknav [data-task="${id}"]`);await select('#speed','10');}
    if(offline)await context.setOffline(true);
  }
  async function reveal(sel){const loc=ui.locator(sel);const ancestors=loc.locator('xpath=ancestor::details');for(let i=0;i<await ancestors.count();i++){const d=ancestors.nth(i);if(!await d.getAttribute('open').then(x=>x!==null))await d.locator(':scope > summary').click();}return loc;}
  async function click(sel){const loc=await reveal(sel);if(touch)await loc.tap();else await loc.click();}
  async function select(sel,v){await (await reveal(sel)).selectOption(String(v));}
  async function fill(sel,v){await (await reveal(sel)).fill(String(v));}
  async function check(sel,v=true){const loc=await reveal(sel);if(await loc.isChecked()!==v)await click(sel);}
  const txt=sel=>ui.locator(sel).textContent();
  async function advance(seconds){await page.clock.runFor(seconds*100+150);}
  async function shot(name){await page.evaluate(()=>window.scrollTo(0,0));fs.mkdirSync(screens,{recursive:true});await page.screenshot({path:path.join(screens,`${label}-${name}.png`),fullPage:true});}
  async function test(name,fn){const start=Date.now();try{await fn();results.push({name,status:'PASS',ms:Date.now()-start});console.log('PASS',label,name);}catch(err){results.push({name,status:'FAIL',error:err.message});await shot('FAILED').catch(()=>{});throw Object.assign(err,{results});}}
  async function target(from,to){await select('#from',from);await select('#to',to);}
  async function filter(){await select('#paper','good');await check('#mounted');await click('#filter-setup');await click('#filter');await advance(9);}
  async function salt({iron=false,finish=true}={}){
    if(iron){await click('#magnet');await advance(5);}
    await click('#water');await click('#stir');await advance(15);await filter();
    if(!finish)return;
    await target('b','dish');await click('#pour');await advance(6);await select('#classic-power','1');await click('#heat');await advance(40);
  }
  async function evaluation(terms,wrong=false){await select('#observed',wrong?'incomplete':'success');if(await ui.locator('#zone-count').count())await select('#zone-count',await ui.locator('#scene [data-band]').evaluateAll(xs=>xs.filter(x=>x.getAttribute('cx')===xs[0]?.getAttribute('cx')).length));if(await ui.locator('#measured-temp').count())await fill('#measured-temp',(await ui.locator('#readings .temperature b').textContent()).replace(' °C',''));for(let i=0;i<terms.length;i++)await fill(`#term-${i}`,terms[i]);await click('#evaluate');}
  async function notebook(){for(let i=0;i<5&&await ui.locator('#theory-next').count();i++)await click('#theory-next');assert.match(await txt('#notebook'),/Muster-Hefteintrag/);assert.match(await txt('#notebook'),/Ergebnis \/ Merksatz/);}
  async function setupDistill({flow='1',thermometer='correct',vent=true}={}){
    for(const k of ['flask','head','condenser','stand','connection','receiver-present'])await check('#'+k);
    await check('#vent',vent);await click('#fill');await click('#stones');await select('#thermometer',thermometer);await select('#hoses','correct');await select('#flow',flow);
  }
  async function heat(){await select('#distill-power','0.6');await click('#distill-heat');}
  const distillAmount=async()=>Number((await ui.locator('#readings .reading').nth(1).locator('b').textContent()).replace(' g',''));
  async function spot(sample,amount=1){await select('#sample',sample);await fill('#spot-amount',amount);await click('#spot');}
  async function develop(seconds=60){await check('#positioned');await click('#start');await advance(seconds);await click('#stop');}

  try{
    await test('A-01 Startansicht und drei Bereiche',async()=>{await fresh();assert.equal(await ui.locator('.category').count(),3);await shot('01-start');});
    await test('E01 K-02 + L-02/03/04 Auswertung und Hefteintrag',async()=>{
      await fresh('K-02');assert.equal(await ui.locator('#notebook').isVisible(),false);await salt();assert.match(await txt('#phase'),/Trennziel erreicht/);await shot('02-salzkristalle');
      await evaluation(['LÖSLICH','Filtrat','falsch'],true);assert.match(await txt('.feedback'),/passt nicht/);assert.equal(await ui.locator('#notebook').isVisible(),false);assert.equal(await ui.locator('#term-0').inputValue(),'LÖSLICH');
      await evaluation(['LÖSLICH','Filtrat','Eindampfen']);assert.equal(await ui.locator('#notebook').isVisible(),true);await notebook();await shot('03-hefteintrag');
      await click('#reset');assert.match(await txt('#notebook'),/Muster-Hefteintrag/);
    });
    await test('E02 trocken filtrieren + E18 kontextbezogene Hilfe',async()=>{
      await fresh('K-02');await filter();assert.doesNotMatch(await txt('#phase'),/Trennziel erreicht/);
      await click('#filter');await advance(9);await evaluation(['löslich','Filtrat','eindampfen']);assert.match(await txt('#offer'),/verfügbar/);
      await click('[data-help="1"]');assert.match(await txt('#hint'),/Löslichkeit/);await click('[data-help="2"]');assert.match(await txt('#hint'),/Wasser/);assert.equal(await ui.locator('[data-help]').count(),3);await shot('04-trocken-fehler');
    });
    await test('E03 Filtrat verwerfen: kein Salz aus dem Nichts',async()=>{await fresh('K-02');await salt({finish:false});await select('#from','b');await click('#discard');await advance(7);await select('#classic-power','1');await click('#heat');await advance(40);assert.doesNotMatch(await txt('#phase'),/Trennziel erreicht/);assert.match(await txt('#scene'),/Verlust 50.0 g/);});
    await test('E04 Sedimentieren/Dekantieren und korrigierbarer Fehlversuch',async()=>{await fresh('K-01');await advance(20);await click('#decant');await advance(8);assert.match(await txt('#phase'),/Trennziel erreicht/);await click('#reset');await advance(20);await click('#fast-decant');await advance(4);assert.doesNotMatch(await txt('#phase'),/Trennziel erreicht/);await shot('05-dekantieren-trueb');await target('b','c');await filter();await target('filter','a');await click('#pour');await advance(6);assert.match(await txt('#phase'),/Trennziel erreicht/);});
    await test('E05 Eisen/Sand/Salz vollständig',async()=>{await fresh('K-03');await salt({iron:true});assert.match(await txt('#phase'),/Trennziel erreicht/);assert.match(await txt('#scene'),/Eisen 8.0 g/);await shot('06-drei-fraktionen');});
    await test('E06 Scheidetrichter und Hahnverluste',async()=>{await fresh('K-04');await target('a','funnel');await click('#pour');await advance(21);await fill('#drain-amount',60);await select('#receiver','b');await click('#valve-open');await advance(31);await fill('#drain-amount',40);await select('#receiver','c');await click('#valve-open');await advance(21);assert.match(await txt('#phase'),/Trennziel erreicht/);await shot('07-phasentrennung');await click('#reset');await target('a','funnel');await click('#pour');await advance(21);await fill('#drain-amount',90);await click('#valve-open');await advance(46);assert.doesNotMatch(await txt('#phase'),/Trennziel erreicht/);await select('#receiver','none');await click('#valve-open');await advance(10);assert.match(await txt('#scene'),/Verlust 10.0 g/);});
    await test('E07 Hibiskus kalt/warm und Pflanzenreste',async()=>{await fresh('K-05');await select('#water-temp','20');await click('#water');await advance(20);const cold=await txt('.inventory');await click('#reset');await select('#water-temp','90');await click('#water');await advance(20);const warm=await txt('.inventory');assert.notEqual(cold,warm);await filter();assert.match(await txt('#phase'),/Trennziel erreicht/);await evaluation(['Extraktion','Stoffgemisch']);await notebook();assert.match(await txt('#notebook'),/kein Reinstoff/);await shot('08-hibiskustee');});
    await test('E08 Chromatographie drei Proben dynamisch + gemeinsame Bande',async()=>{await fresh('C');assert.equal(await ui.locator('#sample option').count(),7);assert.equal(await ui.locator('#solvent option').count(),2);await spot('black');await spot('green');await spot('blue');await check('#positioned');await click('#start');await advance(20);const before=await ui.locator('#scene [data-band="blue"]').first().getAttribute('cy');await shot('09-chroma-zwischen');await advance(40);await click('#stop');const after=await ui.locator('#scene [data-band="blue"]').first().getAttribute('cy');assert.notEqual(before,after);assert.equal(await ui.locator('#scene [data-band]').count(),6);const ys=await ui.locator('#scene [data-band="blue"]').evaluateAll(xs=>xs.map(x=>x.getAttribute('cy')));assert.equal(new Set(ys).size,1);await click('#mark');await click('#archive');assert.equal(await ui.locator('.archive').count(),1);await evaluation(['mobile','stationäre','Adsorption']);await notebook();await shot('10-chroma-ergebnis');});
    await test('E09 wasserfester Stift in Wasser bleibt stehen',async()=>{await fresh('C');await spot('permanent');await develop();assert.equal(await ui.locator('#scene [data-band]').count(),1);assert.equal(await ui.locator('#scene [data-band]').getAttribute('cy'),String(455-15*3.8));await shot('11-wasserfest');});
    await test('E10 untergetauchte Punkte liefern keine Banden',async()=>{await fresh('C');await fill('#level',20);await spot('black');await develop();assert.equal(await ui.locator('#scene [data-band]').count(),0);assert.doesNotMatch(await txt('#phase'),/Trennziel erreicht/);await shot('12-punkte-ausgewaschen');});
    await test('E11 überladener Punkt und Kugelschreiber',async()=>{await fresh('C');await spot('blue',5);await develop();const wide=Number(await ui.locator('#scene [data-band]').getAttribute('ry'));assert.doesNotMatch(await txt('#phase'),/Trennziel erreicht/);await click('#new-paper');await spot('blue',1);await select('#line','pen');await develop();assert.equal(await ui.locator('#scene [data-band]').count(),2);const normal=Number(await ui.locator('#scene [data-band="blue"]').getAttribute('ry'));assert.ok(wide>normal);await shot('13-kugelschreiber');});
    await test('E12 Reinstoff und Experten-Rf korrekt',async()=>{await fresh('C');await spot('blue');await develop();assert.equal(await ui.locator('#scene [data-band]').count(),1);assert.equal(await ui.locator('#expert-values').textContent(),'');await check('#expert');assert.match(await txt('#expert-values'),/ungültig/);await click('#mark');assert.match(await txt('#expert-values'),/0.42/);await shot('14-rf');});
    await test('E13 vollständige Destillation und Brennprobe',async()=>{await fresh('D');await setupDistill();await heat();await advance(7);assert.equal(await distillAmount(),0);await shot('15-destillation-erwaermen');await advance(28);assert.ok(await distillAmount()>5);assert.match(await txt('#readings'),/8\d\.\d °C/);await click('#take-sample');await click('#burn');assert.match(await txt('#notice'),/Kein Reinheitsnachweis/);assert.match(await txt('#phase'),/Trennziel erreicht/);await shot('16-destillation-flamme');await evaluation(['verdampft','kondensiert','Ethanol']);await notebook();});
    await test('E14 Kühlwasser aus verändert Ergebnis',async()=>{await fresh('D');await setupDistill({flow:'0'});await heat();await advance(35);assert.equal(await distillAmount(),0);assert.match(await txt('#scene'),/Dampfverlust: [1-9]/);await shot('17-kuehlung-fehlt');});
    await test('E15 falsches Thermometer, E16 Heizung 0',async()=>{await fresh('D');await setupDistill({thermometer:'wrong'});await advance(50);assert.equal(await distillAmount(),0);await heat();await advance(35);assert.match(await txt('#scene'),/Messung unbrauchbar/);await click('#take-sample');await click('#burn');assert.doesNotMatch(await txt('#phase'),/Trennziel erreicht/);});
    await test('E17 Sicherheitsstopp geschlossen / Zündung / Wiederaufnahme',async()=>{await fresh('D');await setupDistill({vent:false});await heat();assert.match(await txt('#notice'),/Sicherheitsstopp.*Geschlossene/);await check('#vent');await heat();await advance(20);await click('#ignite-apparatus');assert.match(await txt('#notice'),/Sicherheitsstopp.*Zündquelle/);await heat();await advance(15);assert.ok(await distillAmount()>1);await shot('18-sicherheit-korrigiert');});
    await test('A-04 Pause, Entwürfe und Sitzungszustand',async()=>{await fresh('C');await spot('green');await check('#positioned');await click('#start');await click('#pause');const before=await txt('#clock');await advance(40);assert.equal(await txt('#clock'),before);await fill('#term-0','mobile');await click('#pause');await click('#tasknav [data-task="D"]');await click('#tasknav [data-task="C"]');assert.equal(await ui.locator('#term-0').inputValue(),'mobile');await advance(3);await page.reload();ui=frame?page.frameLocator('#sco'):page;await advance(1);assert.equal(await ui.locator('#term-0').inputValue(),'mobile');});
    await test('V-03/04 Layout, Tastatur und lokaler Datenverkehr',async()=>{await fresh('D');await setupDistill();const metrics=await ui.locator('body').evaluate(el=>({width:el.scrollWidth,viewport:el.clientWidth}));assert.ok(metrics.width<=metrics.viewport+1);await ui.locator('#pause').focus();await page.keyboard.press('Enter');assert.equal(await txt('#pause'),'Fortsetzen');await shot('19-layout');assert.deepEqual(errors,[]);assert.deepEqual(external,[]);});
    if(frame)await test('T-03 SCORM Initialize/Finish ohne Datentransfer',async()=>{assert.deepEqual(await page.evaluate(()=>window.calls),['LMSInitialize']);await page.locator('#sco').evaluate(el=>el.src='about:blank');await page.waitForFunction(()=>window.calls.includes('LMSFinish'));assert.deepEqual(await page.evaluate(()=>window.calls),['LMSInitialize','LMSFinish']);});
    return {label,viewport:{width,height,touch},results,consoleErrors:errors,externalRequests:external};
  }finally{await context.close();}
}
