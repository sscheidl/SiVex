(function(){'use strict';const {chem:c,lab:L,render:R}=TL,$=id=>document.getElementById(id),e=R.esc;
  let s=L.state();try{const stored=JSON.parse(sessionStorage.getItem('sivex-trennlabor-v1'));if(stored&&stored.models&&stored.drafts&&stored.records)s=stored;}catch{}
  const options=(items,value)=>items.map(([v,t])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${e(t)}</option>`).join('');
  const select=(id,label,items,value)=>`<label>${label}<select id="${id}">${options(items,value)}</select></label>`;
  const num=(id,label,value,min,max,step=1)=>`<label>${label}<input id="${id}" type="number" value="${value}" min="${min}" max="${max}" step="${step}"></label>`;
  const button=(id,label,cls='')=>`<button id="${id}" class="${cls}">${label}</button>`;
  const check=(id,label,value)=>`<label class="check"><input id="${id}" type="checkbox" ${value?'checked':''}>${label}</label>`;
  const group=(title,content)=>`<details class="tool-group" ${["GEFÄSSE WÄHLEN","TRENNSTREIFEN","GERÄTE PLATZIEREN"].includes(title)?"open":""}><summary>${title}</summary><div>${content}</div></details>`;
  const vesselNames=[['a','Becherglas A'],['b','Becherglas B'],['c','Becherglas C'],['dish','Abdampfschale'],['filter','Filterrückstand'],['magnet','Magnet / Eisen'],['funnel','Scheidetrichter']];
  const val=id=>$(id).value, n=id=>Number(val(id)),yes=id=>$(id).checked;
  const save=()=>{try{sessionStorage.setItem('sivex-trennlabor-v1',JSON.stringify(s));}catch{}};
  function open(id){L.select(s,id);$('landing').hidden=true;$('workspace').hidden=false;build();save();}
  function build(){const m=s.models[s.active],t=L.tasks[s.active];
    $('tasknav').innerHTML=Object.entries(L.tasks).map(([id,v])=>`<button data-task="${id}" aria-pressed="${id===s.active}">${id==='C'?'Chromatographie':id==='D'?'Destillation':id+' · '+e(v.title)}</button>`).join('');
    $('taskid').textContent=s.active==='C'?'02 / FARBSTOFFE UNTERSUCHEN':s.active==='D'?'03 / VERDAMPFEN & KONDENSIEREN':'01 / KLASSISCHE TRENNVERFAHREN · '+s.active;
    $('tasktitle').textContent=t.title;$('goal').textContent=t.goal;
    if(m.kind==='classic')classicControls(m);else if(m.kind==='chroma')chromaControls(m);else distillControls(m);
    $('speed').value=s.speed;$('pause').textContent=s.paused?'Fortsetzen':'Pause';help();assessment();refresh();
  }
  const action=(a,p={})=>{L.act(s,a,p);refresh();help();save();};
  function classicControls(m){
    $('controls').innerHTML=group('GEFÄSSE WÄHLEN',select('from','Ausgangsgefäß',vesselNames,'a')+select('to','Zielgefäß',vesselNames.filter(([v])=>!['filter','magnet'].includes(v)),'b')+button('pour','Umfüllen')+button('discard','Inhalt verwerfen','danger'))+
      group('STOFFE BEARBEITEN',num('water-amount','Wasserportion (g) · Vorrat 500 g',40,0,150)+select('water-temp','Wassertemperatur',[['20','20 °C · kalt'],['60','60 °C · warm'],['90','90 °C · heiß']],60)+button('water','Wasser ins Ausgangsgefäß')+button('stir','Rühren')+button('decant','Vorsichtig dekantieren')+button('fast-decant','Schnell dekantieren')+(m.id==='K-03'?button('magnet','Eisen mit Magnet abtrennen'):''))+
      group('FILTER AUFBAUEN',select('paper','Filterpapier',[['none','Kein Papier'],['bad','Undicht eingesetzt'],['good','Korrekt eingesetzt']],m.filter)+check('mounted','Trichter auf Auffanggefäß',m.mounted)+button('filter-setup','Filteraufbau übernehmen')+button('filter','In Zielgefäß filtrieren','primary')+(m.id==='K-05'?button('sieve','Blüten mit Sieb abtrennen'):''))+
      group('ABDAMPFSCHALE',select('classic-power','Heizplatte',[['0','Aus'],['0.5','Mittlere Leistung'],['1','Hohe Leistung']],m.heat)+button('heat','Heizung einstellen'))+
      (m.id==='K-04'?group('SCHEIDETRICHTER',select('receiver','Auffanggefäß',[['none','Kein Gefäß'],['a','Becherglas A'],['b','Becherglas B'],['c','Becherglas C']],'b')+num('drain-amount','Portion ablassen (g)',20,1,120)+button('valve-open','Hahn öffnen')+button('valve-close','Hahn schließen')+'<p>Die Portion begrenzt den Ausfluss. Jederzeit vorzeitig schließen.</p>'):'')+
      '<details><summary>Stoffbilanz anzeigen</summary><div id="balance-table"></div><p>Mengen in g. Gebundener und gelöster Farbstoff sowie festes und gelöstes Salz werden zusammen bilanziert.</p></details>';
    const p=()=>({from:val('from'),to:val('to')});
    for(const a of ['pour','discard','stir','decant','filter'])$(a).onclick=()=>action(a,p());
    $('water').onclick=()=>action('water',{...p(),amount:n('water-amount'),temp:n('water-temp')});
    $('fast-decant').onclick=()=>action('decant',{...p(),fast:true});
    $('filter-setup').onclick=()=>action('filterSetup',{paper:val('paper'),mounted:yes('mounted')});
    $('heat').onclick=()=>action('heat',{power:n('classic-power')});
    if($('magnet'))$('magnet').onclick=()=>action('magnet',p());
    if($('sieve'))$('sieve').onclick=()=>{action('filterSetup',{paper:'good',mounted:true});action('filter',p());};
    if(m.id==='K-04'){
      $('valve-open').onclick=()=>action('valve',{open:true,receiver:val('receiver'),amount:n('drain-amount')});
      $('valve-close').onclick=()=>action('valve',{open:false});
    }
  }
  function chromaControls(m){
    $('controls').innerHTML=group('TRENNSTREIFEN',select('ch-paper','Papier',[['wide','Breit · 3 Probenplätze'],['narrow','Schmal · 1 Probenplatz']],m.paper)+select('line','Startlinie zeichnen',[['none','Keine Startlinie'],['pencil','Bleistift'],['pen','Kugelschreiber']],m.line)+num('baseline','Höhe der Startlinie (mm)',m.baseline,5,40)+button('new-paper','Neues Papier'))+
      group('PROBEN AUFTRAGEN',select('sample','Modellprobe',c.samples.map(x=>[x.id,x.name]),'black')+num('spot-amount','Punktmenge (Portionen)',1,1,5)+button('spot','Probenpunkt auftragen'))+
      group('ENTWICKLUNGSKAMMER',select('solvent','Laufmittel',Object.entries(c.solvents).map(([k,v])=>[k,v.name]),m.solvent)+num('level','Laufmittelhöhe (mm)',m.level,1,45)+check('positioned','Papier in Kammer eingesetzt',m.positioned)+button('start','Entwicklung starten','primary')+button('stop','Papier herausnehmen / stoppen')+button('mark','Laufmittelfront markieren')+'<p>Das Ethanol-Wasser-Laufmittel ist entzündlich. Diese Simulation hat keine Zündquelle.</p>')+
      group('VERGLEICH & MESSUNG',button('archive','Chromatogramm speichern')+check('expert','Expertenmodus · Laufstrecken / Rf',!!s.expert)+'<div id="expert-values"></div><div id="archives"></div>');
    const configure=()=>{if(!m.started)action('configure',{paper:val('ch-paper'),line:val('line'),baseline:c.clamp(n('baseline'),5,40),level:c.clamp(n('level'),1,45),solvent:val('solvent'),positioned:yes('positioned')});};
    for(const id of ['ch-paper','line','baseline','level','solvent','positioned'])$(id).onchange=configure;
    $('new-paper').onclick=()=>{L.reset(s);build();save();};
    $('spot').onclick=()=>{configure();action('spot',{sample:val('sample'),amount:n('spot-amount')});};
    $('start').onclick=()=>{configure();action('start');};
    for(const a of ['stop','mark','archive'])$(a).onclick=()=>{action(a);chromaExtras();};
    $('expert').onchange=()=>{s.expert=yes('expert');chromaExtras();save();};chromaExtras();
  }
  function chromaExtras(){if(s.active!=='C')return;const m=s.models.C;
    $('expert-values').innerHTML=s.expert?'<p>Rf = Stoffstrecke / Laufmittelstrecke (jeweils ab Startlinie). Front nach dem Stoppen markieren.</p><table><tr><th>Zone</th><th>Strecke</th><th>Rf</th></tr>'+c.bands(m).map(b=>`<tr><td>${e(c.pigments[b.pigment].name)}</td><td>${(b.y-m.baseline).toFixed(1)} mm</td><td>${c.rf(m,b)===null?'ungültig':c.rf(m,b).toFixed(2)}</td></tr>`).join('')+'</table>':'';
    $('archives').innerHTML=m.archive.map((a,i)=>`<div class="archive"><b>Vergleich ${i+1} · ${e(c.solvents[a.solvent].name)}</b>${R.chroma(a,true)}</div>`).join('');
  }
  function distillControls(m){
    $('controls').innerHTML=group('GERÄTE PLATZIEREN',check('flask','Rundkolben auf Heizpilz',m.flask)+check('head','Destillationsaufsatz aufsetzen',m.head)+check('condenser','Liebigkühler verbinden',m.condenser)+check('stand','Stativ / Halterungen befestigen',m.stand)+check('connection','Verbindungen sichern',m.connection)+check('receiver-present','Vorlage aufstellen',m.receiver)+check('vent','Druckausgleich offen',m.vent))+
      group('ANSATZ',num('feed','Ethanol-Wasser-Vorrat (g)',100,1,100)+button('fill','Gemisch in Kolben füllen')+button('stones','Siedesteine zugeben'))+
      group('MESSEN & KÜHLEN',select('thermometer','Thermometerposition',[['none','Nicht eingesetzt'],['wrong','In der Kolbenflüssigkeit'],['correct','Im Dampfweg am Aufsatz']],m.thermometer)+select('hoses','Kühlwasseranschlüsse',[['none','Keine Schläuche'],['reverse','Oben hinein, unten heraus'],['correct','Unten hinein, oben heraus']],m.hoses)+select('flow','Kühlwasserdurchfluss',[['0','Aus'],['0.2','20 % · schwach'],['0.6','60 %'],['1','100 %']],m.flow))+
      group('ERWÄRMEN',select('distill-power','Heizleistung',[['0','0 % · aus'],['0.2','20 % · niedrig'],['0.6','60 % · mittel'],['0.8','80 %'],['1','100 % · übermäßig']],m.power)+button('distill-heat','Heizleistung einstellen','primary'))+
      group('GETRENNTE BRENNPROBE',button('take-sample','1 g Destillat in Prüfschale')+button('burn','Probe in getrennter Schale zünden')+button('ignite-apparatus','Zündversuch am Aufbau','danger')+'<p>Die virtuelle Brennprobe prüft Brennbarkeit. Sie bestimmt weder Reinheit noch einen genauen Alkoholgehalt.</p>');
    function setup(){action('setup',{flask:yes('flask'),head:yes('head'),condenser:yes('condenser'),stand:yes('stand'),connection:yes('connection'),receiver:yes('receiver-present'),vent:yes('vent'),thermometer:val('thermometer'),hoses:val('hoses'),flow:n('flow')});}
    for(const id of ['flask','head','condenser','stand','connection','receiver-present','vent','thermometer','hoses','flow'])$(id).onchange=setup;
    $('fill').onclick=()=>action('fill',{amount:c.clamp(n('feed'),1,100)});$('stones').onclick=()=>action('stones');
    $('distill-heat').onclick=()=>action('heat',{power:n('distill-power')});
    $('take-sample').onclick=()=>action('sample');$('burn').onclick=()=>action('burn');$('ignite-apparatus').onclick=()=>action('igniteApparatus');
  }
  function help(){if(!s.active)return;const m=s.models[s.active];$('offer').textContent=m.errors>=2?'· Hilfe verfügbar':'';
    $('hint').textContent=L.hint(s);document.querySelectorAll('[data-help]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.help===s.help)));}
  function assessment(){const id=s.active,t=L.tasks[id],d=s.drafts[id];
    $('assessment').innerHTML='<p>Halte fest, was dein aktueller Ansatz zeigt. Die Prüfung bezieht sich auf diesen Versuchszustand.</p>'+select('observed','Meine Beobachtung',[['','Bitte selbst auswählen'],['success',t.observation],['incomplete','Das Trennziel ist noch nicht erreicht.']],d.observation)+
      (id==='C'?select('zone-count','Wie viele Farbstoffzonen zeigt die erste Probe?',[['','Selbst zählen'],['0','0 Zonen'],['1','1 Zone'],['2','2 Zonen'],['3','3 Zonen']],d.zones??''):id==='D'?`<label>Abgelesene Dampftemperatur (°C)<input id="measured-temp" inputmode="decimal" value="${e(d.temperature??'')}" autocomplete="off"></label>`:'')+
      t.fields.map(([q],i)=>`<label>${e(q)}<input id="term-${i}" data-term="${i}" autocomplete="off" value="${e(d.terms[i]||'')}" class="${d.checks?d.checks[i]?'answer-ok':'answer-error':''}"></label>`).join('')+
      (s.help===2?`<p class="choice-bank">Begriffshilfe: ${t.fields.map(([,a])=>e(a[0].replace(/ae/g,'ä').replace(/oe/g,'ö'))).join(' · ')}</p>`:'')+button('evaluate','Beobachtung und Begriffe prüfen','primary')+
      '<div class="feedback" role="status">'+(d.feedback||[]).map(x=>`<p>${e(x)}</p>`).join('')+'</div>';
    $('observed').onchange=()=>{d.observation=val('observed');save();};
    if($('zone-count'))$('zone-count').onchange=()=>{d.zones=val('zone-count');save();};
    if($('measured-temp'))$('measured-temp').oninput=()=>{d.temperature=val('measured-temp');save();};
    document.querySelectorAll('[data-term]').forEach(input=>input.oninput=()=>{d.terms[+input.dataset.term]=input.value;save();});
    $('evaluate').onclick=()=>{L.evaluate(s);assessment();help();save();};notebook();
  }
  function notebook(){const id=s.active,r=s.records[id],t=L.tasks[id];$('completed').textContent=r?'· abgeschlossen':'';$('notebook').hidden=!r;if(!r)return;
    $('notebook').innerHTML=`<div class="eyebrow">ABGESCHLOSSENER VERSUCH · ${e(id)} · BEOBACHTUNG BEI ${r.time.toFixed(0)} s</div><h2>Verstehen und im Heft festhalten</h2><p>Dieser erfolgreiche Versuch bleibt gespeichert, auch wenn du anschließend weiter experimentierst.</p>`+
      t.theory.slice(0,r.theory).map(x=>`<p class="theory">${e(x)}</p>`).join('')+(r.theory<t.theory.length?button('theory-next',r.theory===0?'Erklärung beginnen':'Nächsten Zusammenhang anzeigen'): `<article><h2>Muster-Hefteintrag · ${e(t.title)}</h2><p>Schreibe den Eintrag selbst in dein Heft. Passe die Durchführung an deinen gewählten Weg an.</p><h3>Versuch / Durchführung</h3><p>${e(t.method)}</p><h3>Beobachtung</h3><p>${e(t.observation)}</p><h3>Erklärung</h3><p>${t.theory.map(e).join(' ')}</p><h3>Ergebnis / Merksatz</h3><p>${e(t.result)}</p></article>`);
    if($('theory-next'))$('theory-next').onclick=()=>{r.theory++;notebook();save();};
  }
  function reading(label,value,detail='',cls=''){return `<div class="reading ${cls}">${label}<b>${value}</b><small>${detail}</small></div>`;}
  function refresh(){if(!s.active||$('workspace').hidden)return;const m=s.models[s.active],done=L.success(m);
    $('scene').innerHTML=R[m.kind](m);$('phase').textContent=done?'Trennziel erreicht':m.op?'Transfer läuft':m.running?'Entwicklung läuft':m.power>0?'Heizpilz aktiv':'Frei experimentieren';
    $('clock').textContent=`${s.time.toFixed(0)} s`;$('notice').textContent=m.last;
    if(m.kind==='classic'){
      const v=m.vessels;
      $('readings').innerHTML=reading('Wasser im Ansatz',`${Object.entries(v).filter(([k])=>!['waste','vapor'].includes(k)).reduce((n,[,x])=>n+x.water,0).toFixed(1)} g`)+reading('Festes Salz',`${Object.entries(v).filter(([k])=>!['waste','vapor'].includes(k)).reduce((n,[,x])=>n+x.salt,0).toFixed(1)} g`)+reading('Abdampfschale',`${v.dish.temp.toFixed(1)} °C`)+reading('Ziel',done?'Erreicht':'Offen','Fraktionen und Mengen zählen');
      $('readings').innerHTML+='<div class="inventory">'+Object.entries(v).filter(([k])=>!['waste','vapor'].includes(k)).map(([k,x])=>'<span><b>'+e(vesselNames.find(([id])=>id===k)?.[1]||k)+':</b> '+c.keys.filter(key=>x[key]>.01).map(key=>x[key].toFixed(1)+' g '+c.names[key]).join(', ')+'</span>').filter(x=>!x.endsWith(':<\/b> </span>')).join('')+'</div>';
      if($('balance-table'))$('balance-table').innerHTML='<table><tr><th>Stoff</th><th>Gesamt inkl. Verlust</th></tr>'+Object.entries(c.balance(m)).map(([k,n])=>`<tr><td>${e(c.names[k]||'Farbstoff')}</td><td>${n.toFixed(2)} g</td></tr>`).join('')+'</table>';
    }else if(m.kind==='chroma'){
      $('readings').innerHTML=reading('Laufmittelfront',`${m.front.toFixed(1)} mm`)+reading('Startlinie',`${m.baseline} mm`)+reading('Sichtbare Zonen',c.bands(m).length)+reading('Front markiert',m.marked===null?'Nein':`${m.marked.toFixed(1)} mm`);if(s.expert)chromaExtras();
    }else{
      const temp=m.thermometer==='correct'?m.vaporTemp:null;
      $('readings').innerHTML=reading('Dampftemperatur',temp===null?'— °C':`${temp.toFixed(1)} °C`,temp===null?'Thermometerposition prüfen':'Messstelle im Dampfweg','temperature')+reading('Destillat',`${(m.collected.water+m.collected.ethanol).toFixed(2)} g`,m.collected.water+m.collected.ethanol>0?'Zusammensetzung verändert sich':'noch kein Kondensat')+reading('Kondensation',`${m.condenseRate.toFixed(2)} g/s`)+reading('Kolben',`${m.temp.toFixed(1)} °C`,'Flüssigkeitstemperatur');
      if(m.history.length>1){const pts=m.history.map((p,i)=>`${i/(m.history.length-1)*230},${56-p.temp*.48}`).join(' ');$('readings').innerHTML+=`<div class="reading">Dampftemperatur über die Zeit<svg viewBox="0 0 240 64" role="img" aria-label="Temperaturverlauf" style="width:100%;height:64px"><path d="M0 8H235M0 56H235" stroke="#dce5df"/><polyline points="${pts}" fill="none" stroke="#247f75" stroke-width="2"/></svg></div>`;}
    }
  }
  document.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;if(b.dataset.task)open(b.dataset.task);if(b.dataset.category)open('K-01');if(b.dataset.help){s.help=+b.dataset.help;help();assessment();save();}});
  $('home').onclick=()=>{$('landing').hidden=false;$('workspace').hidden=true;save();};
  $('reset').onclick=()=>{L.reset(s);build();save();};$('speed').onchange=()=>{s.speed=n('speed');save();};$('pause').onclick=()=>{s.paused=!s.paused;$('pause').textContent=s.paused?'Fortsetzen':'Pause';save();};
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('fullscreen').textContent='Vollbild im Browser öffnen';}};
  const previewClassic=c.classic('K-02');previewClassic.vessels.a.water=60;previewClassic.filter='good';previewClassic.mounted=true;
  $('art-classic').innerHTML=R.classic(previewClassic);
  const previewChroma=c.chroma();Object.assign(previewChroma,{started:true,front:85,lanes:[{sample:'black',amount:1},{sample:'green',amount:1},{sample:'blue',amount:1}]});$('art-chroma').innerHTML=R.chroma(previewChroma,true);
  const previewDistill=c.distill();Object.assign(previewDistill,{flask:true,head:true,condenser:true,stand:true,receiver:true,thermometer:'correct',hoses:'correct',water:70,ethanol:30});$('art-distill').innerHTML=R.distill(previewDistill);
  if(s.active)open(s.active);
  let last=performance.now(),paint=0,stored=0;
  function frame(now){const dt=Math.min(.2,(now-last)/1000);last=now;if(!$('workspace').hidden)L.step(s,dt);paint+=dt;stored+=dt;if(paint>.12){refresh();help();paint=0;}if(stored>2){save();stored=0;}requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();
