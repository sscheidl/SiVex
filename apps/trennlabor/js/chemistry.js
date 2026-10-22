/* DOM-freie Stoffmodelle. Alle Mengen in g, Zeit in Modellssekunden. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object') module.exports = api;
  else (root.TL = root.TL || {}).chem = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const keys = ['water', 'sand', 'salt', 'dissolved', 'iron', 'oil', 'petals', 'bound', 'dye'];
  const names = { water:'Wasser', sand:'Sand', salt:'Kochsalz fest', dissolved:'Kochsalz gelöst', iron:'Eisen', oil:'Öl', petals:'Blütenreste', bound:'Farbstoff gebunden', dye:'Farbstoff gelöst' };
  const empty = () => Object.assign(Object.fromEntries(keys.map(k => [k, 0])), {temp:20, settled:0, mixing:0});
  const total = v => keys.reduce((n, k) => n + v[k], 0);
  const solids = v => v.sand + v.salt + v.iron + v.petals;
  const liquids = v => v.water + v.oil;
  const initial = {
    'K-01': {water:80, sand:10}, 'K-02': {sand:10, salt:10},
    'K-03': {iron:8, sand:10, salt:10}, 'K-04': {water:60, oil:40},
    'K-05': {petals:4, bound:1}
  };
  function classic(id) {
    const vessels = Object.fromEntries(['a','b','c','dish','filter','magnet','funnel','waste','vapor'].map(k => [k, empty()]));
    Object.assign(vessels.a, initial[id]);
    return {kind:'classic', id, vessels, addedWater:0, filter:'none', mounted:false, heat:0, valve:false,
      receiver:'b', drainAmount:20, drained:0, op:null, elapsed:0, last:'Ausgangsgemisch in Becherglas A.', errors:0};
  }
  function message(s, msg, error=false) { s.last=msg; if(error) s.errors++; }
  function transfer(s, from, to, fractions, duration=5, mode='pour') {
    if(s.op) return message(s,'Der laufende Transfer muss erst enden.',true);
    if(from===to || !s.vessels[from] || !s.vessels[to]) return message(s,'Zwei verschiedene Gefäße wählen.',true);
    const src=s.vessels[from];
    if(total(src)<0.001) return message(s,'Das gewählte Ausgangsgefäß ist leer.',true);
    const amounts=Object.fromEntries(keys.map(k=>[k,src[k]*(fractions[k] ?? 1)]));
    s.op={from,to,amounts,duration,elapsed:0,mode,sourceTemp:src.temp};
    message(s, mode==='filter' ? 'Der Ansatz fließt durch den Trichter.' : 'Der Stofftransfer läuft.');
  }
  function actClassic(s, action, p={}) {
    const v=s.vessels[p.from || 'a'];
    if(action==='water') {
      const n=clamp(Number(p.amount)||0,0,Math.min(500-s.addedWater,150));
      if(s.op) return message(s,'Während des Transfers kein Wasser zugeben.',true);
      const before=total(v); const t=clamp(Number(p.temp)||20,20,90);
      v.temp=(v.temp*before+t*n)/(before+n || 1); v.water+=n; v.settled=0; s.addedWater+=n;
      message(s,`${n} g Wasser zugegeben (${t} °C).`);
    }
    if(action==='stir') {v.mixing=8; v.settled=0; message(s,'Umgerührt: Feststoffe werden aufgewirbelt, Lösen und Extraktion beschleunigen sich.');}
    if(action==='filterSetup') { s.filter=p.paper; s.mounted=!!p.mounted; message(s, s.mounted ? 'Trichter auf Auffanggefäß gesetzt.' : 'Trichter steht ohne Auffanggefäß.'); }
    if(action==='pour' || action==='discard') transfer(s,p.from,action==='discard'?'waste':p.to,{},5);
    if(action==='filter') {
      if(!s.mounted) return transfer(s,p.from,'waste',{},6,'filter');
      const retention=s.filter==='good'?1:s.filter==='bad'?0.5:0;
      if(p.to==='filter' || p.from==='filter') return message(s,'Filterrückstand durch Umfüllen erneut bearbeiten; ein anderes Auffanggefäß wählen.',true);
      if(v.water<0.1) message(s,'Trockenes Filtrieren trennt Sand und Salz nicht.',true);
      transfer(s,p.from,p.to,{},8,'filter');
      if(s.op) s.op.retention=retention;
      if(retention<1) message(s,'Das Filterpapier hält die Feststoffe nicht vollständig zurück.',true);
    }
    if(action==='decant') {
      const solidFraction=p.fast ? 0.55 : 0.03+0.65*(1-v.settled);
      transfer(s,p.from,p.to,{water:0.92,dissolved:0.92,dye:0.92,oil:0.92,sand:solidFraction,salt:solidFraction,iron:solidFraction,petals:solidFraction,bound:solidFraction},p.fast?2:6,'decant');
      if(p.fast || v.settled<0.85) message(s,'Aufgewirbelter Feststoff gelangt mit in die Flüssigkeit. Erneutes Absetzen ist möglich.',true);
    }
    if(action==='magnet') {
      transfer(s,p.from,'magnet',Object.fromEntries(keys.map(k=>[k,k==='iron'?1:0])),4,'magnet');
      if(v.iron<0.001) message(s,'Der Magnet erfasst hier keinen Stoff: Nur Eisen ist magnetisch.',true);
    }
    if(action==='heat') {s.heat=clamp(Number(p.power)||0,0,1); message(s,s.heat?'Abdampfschale wird erhitzt.':'Heizung ausgeschaltet.');}
    if(action==='valve') {s.valve=!!p.open; s.receiver=p.receiver || 'none'; s.drainAmount=Number(p.amount)||20; s.drained=0; message(s,s.valve?'Hahn geöffnet.':'Hahn geschlossen.');}
  }
  function tickClassic(s, dt) {
    s.elapsed+=dt;
    if(s.op) {
      const o=s.op, delta=Math.min(dt,o.duration-o.elapsed)/o.duration;
      for(const k of keys) {
        const n=Math.min(s.vessels[o.from][k],o.amounts[k]*delta);
        const retained=o.mode==='filter' && ['sand','salt','iron','petals','bound'].includes(k)?n*(o.retention ?? 0):0;
        s.vessels[o.from][k]-=n;
        s.vessels.filter[k]+=retained;
        const dest=s.vessels[o.to], m=total(dest);
        dest.temp=(dest.temp*m+o.sourceTemp*(n-retained))/(m+n-retained || 1);
        dest[k]+=n-retained; dest.settled=0;
      }
      o.elapsed+=dt; if(o.elapsed>=o.duration-1e-8) s.op=null;
    }
    for(const [id,v] of Object.entries(s.vessels)) {
      if(['waste','vapor','magnet'].includes(id)) continue;
      v.mixing=Math.max(0,v.mixing-dt);
      v.settled=clamp(v.settled+dt*(v.mixing>0?-1:0.075),0,1);
      if(v.water>0.001) {
        const capacity=Math.max(0,v.water*0.36-v.dissolved);
        const d=Math.min(v.salt,capacity,(v.mixing>0?2:0.1)*dt);
        v.salt-=d; v.dissolved+=d;
        const e=Math.min(v.bound, v.bound*(0.002+(v.temp-20)*0.0012)*(v.mixing>0?2:1)*dt);
        v.bound-=e; v.dye+=e;
      }
      if(id==='dish' && s.heat>0 && total(v)>0.001) {
        v.temp=Math.min(100,v.temp+s.heat*8*dt);
        if(v.temp>=99.9) {const n=Math.min(v.water,s.heat*2.5*dt); v.water-=n; s.vessels.vapor.water+=n;}
      } else v.temp+=(20-v.temp)*0.001*dt;
      const crystal=Math.max(0,v.dissolved-v.water*0.36); v.dissolved-=crystal; v.salt+=crystal;
    }
    if(s.valve) {
      const f=s.vessels.funnel, available=liquids(f);
      const n=Math.min(available,2*dt,s.drainAmount-s.drained);
      if(n>0) {
        let w=f.settled>=0.85 ? Math.min(n,f.water) : n*f.water/(available || 1);
        let oil=n-w;
        oil=Math.min(oil,f.oil); w=Math.min(n-oil,f.water);
        const out=s.vessels[s.receiver==='none'?'waste':s.receiver];
        f.water-=w;f.oil-=oil;out.water+=w;out.oil+=oil;s.drained+=n;
        if(s.receiver==='none') message(s,'Ohne Auffanggefäß geht die Probe verloren.',true);
      }
      if(available<0.001 || s.drained>=s.drainAmount-1e-8) {s.valve=false;message(s,'Eingestellte Portion abgelassen; Hahn geschlossen.');}
    }
    // Begrenzte Gefäßkapazität; Überlauf ist expliziter Verlust.
    for(const id of ['a','b','c','dish','funnel']) {
      const v=s.vessels[id], cap=id==='funnel'?120:id==='dish'?180:250;
      if(total(v)>cap) { const f=(total(v)-cap)/total(v); for(const k of keys){const n=v[k]*f;v[k]-=n;s.vessels.waste[k]+=n;} message(s,'Gefäß übergelaufen: Stoff ist im Verlustbehälter.',true); }
    }
  }
  function classicSuccess(s) {
    const vs=Object.entries(s.vessels).filter(([k])=>!['waste','vapor','funnel'].includes(k)).map(([,v])=>v);
    const pure=(k,min,allowed=[])=>vs.some(v=>v[k]>=min && keys.filter(x=>x!==k&&!allowed.includes(x)).reduce((n,x)=>n+v[x],0)<0.4);
    if(s.id==='K-01') return pure('water',64) && pure('sand',8,['water']);
    if(s.id==='K-02') return pure('sand',8,['water']) && pure('salt',8);
    if(s.id==='K-03') return pure('sand',8,['water']) && pure('salt',8) && pure('iron',6.4,['water']);
    if(s.id==='K-04') return pure('water',48) && pure('oil',32);
    return vs.some(v=>v.water>=20&&v.dye>=0.35&&v.petals<0.1&&v.bound<0.1) && vs.some(v=>v.petals>=3.2);
  }
  function balance(s) {
    const sum=empty(); for(const v of Object.values(s.vessels)) for(const k of keys) sum[k]+=v[k];
    return {water:sum.water, sand:sum.sand,salt:sum.salt+sum.dissolved,iron:sum.iron,oil:sum.oil,petals:sum.petals,pigment:sum.bound+sum.dye};
  }
  const pigments={blue:{name:'Blau',color:'#246ad3'},yellow:{name:'Gelb',color:'#e7b710'},red:{name:'Rot',color:'#d33667'},black:{name:'Wasserfester Schwarzanteil',color:'#303b4b'}};
  const samples=[
    {id:'black',name:'Schwarz · wasserlöslich',parts:['yellow','red','blue']},
    {id:'green',name:'Grün · wasserlöslich',parts:['yellow','blue']},
    {id:'purple',name:'Violett · wasserlöslich',parts:['red','blue']},
    {id:'orange',name:'Orange · wasserlöslich',parts:['yellow','red']},
    {id:'blue',name:'Blau · Referenz',parts:['blue']},
    {id:'yellow',name:'Gelb · Referenz',parts:['yellow']},
    {id:'permanent',name:'Schwarz · wasserfest',parts:['black']}
  ];
  // Rf-Werte virtueller Modellproben, keine Marken-/Messdaten.
  const solvents={water:{name:'Wasser',rf:{blue:0.42,yellow:0.78,red:0.60,black:0},rate:1},
    ethanol:{name:'Ethanol/Wasser 60:40 (Volumen)',rf:{blue:0.65,yellow:0.85,red:0.48,black:0.30},rate:1.1}};
  function chroma() {return {kind:'chroma',id:'C',paper:'wide',line:'pencil',baseline:15,level:5,solvent:'water',lanes:[],running:false,started:false,front:5,marked:null,washed:false,positioned:false,elapsed:0,last:'Wähle Papier, Startlinie und bis zu drei Proben.',errors:0,archive:[]};}
  function actChroma(s,a,p={}) {
    if(a==='archive') {if(s.started&&!s.running){s.archive.push(JSON.parse(JSON.stringify({...s,archive:[]})));message(s,'Chromatogramm zum Vergleich gespeichert.');}else message(s,'Entwicklung zuerst starten und stoppen.',true);return;}
    if(a==='stop') {s.running=false;message(s,'Papier herausgenommen. Front jetzt markieren.');return;}
    if(a==='mark') {s.marked=s.started&&!s.running&&s.front<99?s.front:null;message(s,s.marked===null?'Keine sicher bestimmbare Front: Entwicklung stoppen, bevor der Rand erreicht ist.':'Laufmittelfront mit Bleistift markiert.',s.marked===null);return;}
    if(s.started) return message(s,'Für einen neuen Ansatz „Neues Papier“ wählen. Vergleich bleibt erhalten.',true);
    if(a==='configure') {for(const k of ['paper','line','baseline','level','solvent','positioned']) if(p[k]!==undefined)s[k]=p[k];s.front=s.level;}
    if(a==='spot') {
      const max=s.paper==='narrow'?1:3;
      if(s.lanes.length>=max) return message(s,`Dieses Papier bietet ${max} Probenplatz/-plätze.`,true);
      if(!samples.some(x=>x.id===p.sample))return;
      s.lanes.push({sample:p.sample,amount:clamp(Number(p.amount)||1,1,5)});message(s,'Probenpunkt auf die Startlinie aufgetragen.');
    }
    if(a==='start') {
      if(!s.positioned||!s.lanes.length||s.line==='none')return message(s,'Papier einsetzen, Startlinie zeichnen und Probe auftragen.',true);
      s.started=true;s.running=true;s.washed=s.level>=s.baseline;
      message(s,s.washed?'Probenpunkte tauchen ins Laufmittel: Farbstoff löst sich in der Kammer.':s.line==='pen'?'Kugelschreibertinte erzeugt eine zusätzliche Spur.':'Das Laufmittel steigt durch das Papier.',s.washed||s.line==='pen');
    }
  }
  function tickChroma(s,dt) {if(s.running){s.elapsed+=dt;s.front=Math.min(100,Math.sqrt(s.level*s.level+90*solvents[s.solvent].rate*s.elapsed));if(s.front>=100){s.running=false;s.marked=null;message(s,'Laufmittel am Papierrand: Front nicht mehr sicher bestimmbar.',true);}}}
  function bands(s) {
    if(!s.started||s.washed)return [];
    return s.lanes.flatMap((l,i)=>samples.find(x=>x.id===l.sample).parts.map(k=>({lane:i,pigment:k,y:s.baseline+Math.max(0,s.front-s.baseline)*solvents[s.solvent].rf[k],width:2+l.amount*1.6})))
      .concat(s.line==='pen'?[{lane:-1,pigment:'red',y:s.baseline+Math.max(0,s.front-s.baseline)*0.55,width:9}]:[]);
  }
  function chromaSuccess(s) {return s.started&&!s.running&&!s.washed&&s.line==='pencil'&&s.front-s.baseline>30&&s.lanes.every(l=>l.amount<=2);}
  function rf(s,band) {return s.marked!==null&&s.marked>s.baseline&&!s.washed?(band.y-s.baseline)/(s.marked-s.baseline):null;}
  function distill() {return {kind:'distill',id:'D',flask:false,head:false,condenser:false,stand:false,receiver:false,connection:false,vent:true,thermometer:'none',hoses:'none',flow:0,stones:false,power:0,
    water:0,ethanol:0,temp:20,vaporTemp:20,vaporRate:0,condenseRate:0,collected:{water:0,ethanol:0},lost:{water:0,ethanol:0},sample:{water:0,ethanol:0},burned:{water:0,ethanol:0},feed:{water:0,ethanol:0},flame:false,burnResult:null,stop:null,elapsed:0,last:'Baue die Apparatur aus den bereitliegenden Geräten auf.',errors:0,history:[]};}
  const fraction=v=>v.ethanol/(v.ethanol+v.water || 1);
  const boiling=x=>100-22*Math.sqrt(clamp(x,0,1));
  function safety(s) {
    if(!s.vent)return 'Geschlossene Apparatur: Druckaufbau. Druckausgleich öffnen.';
    if(!s.flask||!s.head||!s.condenser||!s.stand||!s.connection)return 'Apparatur ungesichert oder Verbindung offen. Bauteile montieren und Verbindungen sichern.';
    if(s.water+s.ethanol<5)return 'Zu wenig Flüssigkeit im Kolben. Heizung ausgeschaltet.';
    if(s.power>0.85)return 'Zu hohe Heizleistung: Gefahr von Überkochen und Mitreißen. Leistung verringern.';
    return null;
  }
  function interrupt(s,msg){s.power=0;s.stop=msg;message(s,'Sicherheitsstopp: '+msg,true);}
  function actDistill(s,a,p={}) {
    if(a==='setup') {
      for(const k of ['flask','head','condenser','stand','receiver','connection','vent','thermometer','hoses','flow'])if(p[k]!==undefined)s[k]=p[k];
      if(!s.vent&&s.temp>40)interrupt(s,'Heiße Apparatur nicht verschließen. Druckausgleich öffnen.');
      else if(s.power>0){const why=safety(s);if(why)interrupt(s,why);}
    }
    if(a==='fill') {
      if(s.temp>40)return message(s,'Vor dem Nachfüllen abkühlen lassen.',true);
      if(s.feed.ethanol+s.feed.water>0)return message(s,'Der begrenzte Vorrat ist bereits eingefüllt.',true);
      if(!s.flask)return message(s,'Zuerst den Kolben aufstellen.',true);
      const n=clamp(Number(p.amount)||0,1,100);s.water+=n*0.7;s.ethanol+=n*0.3;s.feed={water:n*0.7,ethanol:n*0.3};message(s,`${n} g Ethanol-Wasser-Gemisch (30 Massen-% Ethanol) eingefüllt.`);
    }
    if(a==='stones') {if(s.temp>40)return interrupt(s,'Siedesteine nie in heiße Flüssigkeit geben. Erst abkühlen lassen.');s.stones=true;message(s,'Siedesteine im kalten Ansatz.');}
    if(a==='heat') {s.power=clamp(Number(p.power)||0,0,1);s.stop=null;const why=s.power>0?safety(s):null;if(why)interrupt(s,why);else message(s,s.power?'Heizpilz eingeschaltet.':'Heizung ausgeschaltet.');}
    if(a==='sample') {
      if(s.sample.ethanol+s.sample.water>0)return message(s,'Vorhandene Probe zuerst prüfen.',true);
      const n=s.collected.ethanol+s.collected.water;
      if(n<1)return message(s,'Mindestens 1 g Destillat in der Vorlage nötig.',true);
      const x=fraction(s.collected);s.sample={ethanol:x,water:1-x};s.collected.ethanol-=x;s.collected.water-=1-x;s.burnResult=null;message(s,'1 g Probe in die getrennte Prüfschale entnommen.');
    }
    if(a==='igniteApparatus')return interrupt(s,'Keine Zündquelle an der Destillationsapparatur. Nur die getrennte Prüfschale verwenden.');
    if(a==='burn') {
      if(s.sample.water+s.sample.ethanol<0.9)return message(s,'Zuerst eine kleine Probe in die getrennte Schale entnehmen.',true);
      s.burnResult=fraction(s.sample)>=0.45;s.flame=s.burnResult;s.flameTime=5;
      for(const k of ['ethanol','water']) {s.burned[k]+=s.sample[k];s.sample[k]=0;}
      message(s,s.burnResult?'Bläuliche Flamme: Probe ist unter Modellbedingungen brennbar. Kein Reinheitsnachweis.':'Keine anhaltende Flamme: Probe ist zu wasserreich.');
    }
  }
  function tickDistill(s,dt) {
    s.elapsed+=dt;s.vaporRate=0;s.condenseRate=0;
    if(s.flameTime>0){s.flameTime-=dt;if(s.flameTime<=0)s.flame=false;}
    const n=s.water+s.ethanol;
    if(s.power>0){const why=safety(s);if(why){interrupt(s,why);return;}}
    const x=fraction(s),bp=boiling(x);
    if(s.power>0 && n>=5) {
      s.temp=Math.min(bp,s.temp+dt*(s.power*10-0.3)*100/(n+0.001));
      if(s.temp>=bp-0.03) {
        const rate=Math.max(0,s.power-0.12)*1.8*(s.stones?1:0.55);
        const amount=Math.min(n-4.99,rate*dt);
        const y=4*x/(1+3*x); // relative Flüchtigkeit 4, vereinfachtes Unterrichtsmodell
        const e=Math.min(s.ethanol,amount*y),w=Math.min(s.water,amount-e);
        const efficiency=s.hoses==='correct'?clamp(s.flow,0,1):s.hoses==='reverse'?clamp(s.flow*0.2,0,0.2):0;
        const capture=s.receiver?efficiency:0;
        s.ethanol-=e;s.water-=w;s.collected.ethanol+=e*capture;s.collected.water+=w*capture;
        s.lost.ethanol+=e*(1-capture);s.lost.water+=w*(1-capture);
        s.vaporRate=(e+w)/dt;s.condenseRate=s.vaporRate*capture;
        s.vaporTemp+=(bp-s.vaporTemp)*Math.min(1,dt*2);
      } else s.vaporTemp+=(20-s.vaporTemp)*dt*0.08;
    } else {s.temp+=(20-s.temp)*dt*0.06;s.vaporTemp+=(20-s.vaporTemp)*dt*0.1;}
    if(s.history.length===0||s.elapsed-s.history.at(-1).time>=1)s.history.push({time:s.elapsed,temp:s.vaporTemp,amount:s.collected.ethanol+s.collected.water});
    if(s.history.length>600)s.history.shift();
  }
  const distillSuccess=s=>s.collected.ethanol+s.collected.water>=3&&fraction(s.collected)>0.31&&s.thermometer==='correct'&&s.burnResult===true&&s.hoses==='correct'&&s.flow>=0.5&&!s.stop;
  return {clamp,keys,names,empty,total,solids,liquids,initial,classic,actClassic,tickClassic,classicSuccess,balance,
    pigments,samples,solvents,chroma,actChroma,tickChroma,bands,chromaSuccess,rf,distill,actDistill,tickDistill,distillSuccess,fraction,boiling};
});
