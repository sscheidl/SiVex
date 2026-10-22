/* Reine SVG-Ausgabe aus dem berechneten Zustand. */
(function(root){'use strict';const c=root.TL.chem;
  const esc=x=>String(x).replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
  const text=(x,y,t,size=13,color='#33535b',anchor='start')=>`<text x="${x}" y="${y}" font-family="system-ui,sans-serif" font-size="${size}" fill="${color}" text-anchor="${anchor}">${esc(t)}</text>`;
  const defs=`<defs><linearGradient id="glass"><stop stop-color="#cce5e6" stop-opacity=".55"/><stop offset=".2" stop-color="white" stop-opacity=".7"/><stop offset=".5" stop-color="#dcebea" stop-opacity=".1"/><stop offset=".9" stop-color="white" stop-opacity=".5"/><stop offset="1" stop-color="#b6d5d9" stop-opacity=".6"/></linearGradient><linearGradient id="water" x2="0" y2="1"><stop stop-color="#a9d7e0" stop-opacity=".6"/><stop offset="1" stop-color="#5aa1b9" stop-opacity=".6"/></linearGradient><linearGradient id="steel"><stop stop-color="#445a60"/><stop offset=".4" stop-color="#b7c8c7"/><stop offset=".7" stop-color="#70878b"/><stop offset="1" stop-color="#31464e"/></linearGradient><linearGradient id="table" x2="0" y2="1"><stop stop-color="#d0ddd5"/><stop offset="1" stop-color="#aec2b6"/></linearGradient><filter id="soft"><feGaussianBlur stdDeviation="3"/></filter></defs>`;
  let serial=0;
  const shell=(body,label='Versuchsaufbau')=>`<svg viewBox="0 0 900 540" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label)}">${defs}<rect width="900" height="540" fill="#eaf1ed"/><path d="M0 420H900V540H0Z" fill="url(#table)"/><path d="M0 420H900" stroke="#acbfb3" stroke-width="3"/>${body}</svg>`.replace(/id="([^"]+)"/g, (_,id)=>`id="svg${serial}-${id}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#svg${serial}-${id})`).replace(/<svg /,()=>{serial++;return '<svg ';});
  function beaker(v,x,y,label,small=false,time=0){
    const w=small?105:135,h=small?105:155,n=c.total(v),water=v.water+v.oil;
    const level=Math.min(h-20,water*1.1),solidH=Math.min(35,c.solids(v)*1.8),bottom=y+h;
    let b=`<ellipse cx="${x+w/2}" cy="${bottom+9}" rx="${w*.6}" ry="8" fill="#3a5b4a" opacity=".09"/>`;
    if(water>0.01){const col=v.dye>0.001?`rgba(167,31,77,${Math.min(.88,.2+v.dye*.6)})`:'url(#water)';const oilH=level*v.oil/(water||1);b+=`<rect x="${x+5}" y="${bottom-level}" width="${w-10}" height="${Math.max(0,level-3)}" fill="${col}"/>`;
      if(v.oil>0.01)b+=`<rect x="${x+5}" y="${bottom-level}" width="${w-10}" height="${oilH}" fill="#d8b547" opacity=".65"/>`;
      b+=`<path d="M${x+5} ${bottom-level} Q${x+w/2} ${bottom-level+3+Math.sin(time*3)*2} ${x+w-5} ${bottom-level}" fill="none" stroke="#80b6c5"/>`;
    }
    if(c.solids(v)>0.01){
      b+=`<rect x="${x+6}" y="${bottom-3-solidH}" width="${w-12}" height="${solidH}" fill="${v.petals>0.1?'#6f3044':v.sand>0.1?'#c4a679':v.iron>0.1?'#697a80':'#f9f8f0'}" opacity=".85"/>`;
      for(let i=0;i<45;i++){const yy=water>0&&v.settled<.9?bottom-8-((i*19+time*(v.mixing>0?35:3))%Math.max(10,level))*(1-v.settled):bottom-5-(i*7)%Math.max(3,solidH-4);b+=`<circle cx="${x+10+(i*37)%(w-20)}" cy="${yy}" r="${v.petals>0.1?2.8:1.2}" fill="${v.salt>v.sand?'#ffffff':v.petals>0.1?'#8d324b':'#957b57'}" opacity=".7"/>`;}
    }
    if(v.salt>0.05&&v.water<0.1)for(let i=0;i<12;i++)b+=`<rect x="${x+12+(i*29)%(w-26)}" y="${bottom-7-(i*7)%Math.max(5,solidH)}" width="5" height="5" transform="rotate(20 ${x+w/2} ${bottom-10})" fill="white" stroke="#bfc6bf"/>`;
    b+=`<path d="M${x} ${y} L${x+3} ${bottom-5} Q${x+3} ${bottom} ${x+10} ${bottom} H${x+w-9} Q${x+w-3} ${bottom} ${x+w-3} ${bottom-6} V${y+6} L${x+w+8} ${y}" fill="url(#glass)" stroke="#6b929d" stroke-width="2"/><path d="M${x+12} ${y+12} V${bottom-15}" stroke="white" stroke-width="3" opacity=".75"/>`;
    for(let i=1;i<=4;i++)b+=`<path d="M${x+w-24} ${bottom-i*h/5} h18" stroke="#7698a0"/>`;
    b+=text(x+w/2,bottom+29,label,13,'#274d55','middle');
    b+=text(x+w/2,bottom+47,`${n.toFixed(1)} g`,12,'#58746b','middle');return b;
  }
  function classic(s){let b='';
    const positions={a:[75,245],b:[290,245],c:[505,245],dish:[710,310]};
    for(const [k,[x,y]] of Object.entries(positions)){
      if(k!=='dish')b+=beaker(s.vessels[k],x,y,{a:'Becherglas A',b:'Becherglas B',c:'Becherglas C'}[k],false,s.elapsed);
      else {
        const v=s.vessels.dish,level=Math.min(25,v.water*.6);
        b+=`<ellipse cx="764" cy="424" rx="66" ry="8" fill="#365a49" opacity=".1"/><path d="M699 369Q764 401 829 369L814 405Q764 428 713 405Z" fill="#fafbf7" stroke="#829b9b" stroke-width="2"/><ellipse cx="764" cy="372" rx="64" ry="12" fill="#edf0e7" stroke="#9badac"/>`;
        if(v.water>.01)b+=`<ellipse cx="764" cy="${380-level*.3}" rx="${41+level*.6}" ry="${5+level*.2}" fill="url(#water)"/>`;
        if(c.solids(v)>.01)for(let i=0;i<22;i++)b+=`<rect x="${726+(i*29)%72}" y="${375+(i*13)%16}" width="${v.salt>0?5:3}" height="${v.salt>0?5:3}" fill="${v.sand>.1?'#b59a74':'white'}" stroke="${v.sand>.1?'#a08c69':'#c7cbc1'}"/>`;
        b+=text(764,452,'Abdampfschale',13,'#274d55','middle')+text(764,470,`${c.total(v).toFixed(1)} g`,12,'#58746b','middle');
      }
    }
    if(s.heat>0){b+=`<rect x="699" y="416" width="130" height="20" rx="5" fill="#54746f"/><path d="M715 412H815" stroke="#ca633f" stroke-width="5"/>`;if(s.vessels.dish.temp>98&&s.vessels.dish.water>0)for(let i=0;i<7;i++)b+=`<circle cx="${725+i*12}" cy="${290-(s.elapsed*22+i*14)%65}" r="${4+i%3}" fill="white" opacity=".6"/>`;}
    if(s.id==='K-04'){
      const f=s.vessels.funnel,level=Math.min(105,c.liquids(f));const lower=f.water/(c.liquids(f)||1);
      b+=`<path d="M656 77V319M625 319H685M656 125H714" fill="none" stroke="url(#steel)" stroke-width="7"/><path d="M710 53H760L774 93L754 176L737 203V230H728V203L709 176L692 93Z" fill="url(#glass)" stroke="#729ba5" stroke-width="2"/>`;
      if(level>0)b+=`<path d="M710 ${198-level} H756 L748 174L737 195H728L716 174Z" fill="#d6b74d" opacity=".6"/><path d="M${724-lower*12} ${198-level*lower} H${740+lower*12} L737 198H728Z" fill="#78b5cf" opacity=".8"/>`;
      b+=`<path d="M719 221H746" stroke="${s.valve?'#238271':'#895c4a'}" stroke-width="5"/>`+text(733,37,'Scheidetrichter',13,'#33535b','middle')+text(790,119,'Öl oben',11)+text(790,163,'Wasser unten',11)+text(733,250,`${c.total(f).toFixed(1)} g`,11,'#33535b','middle');
      if(s.valve)b+=`<path d="M733 234V273" stroke="#7cb3c9" stroke-dasharray="4 7" stroke-dashoffset="${-s.elapsed*12}" stroke-width="3"/>`;
    } else {
      b+=`<path d="M315 73H415L370 141V186H360V141Z" fill="url(#glass)" stroke="#729ba5" stroke-width="2"/>`;
      if(s.filter!=='none')b+=`<path d="M322 82H407L365 137Z" fill="${s.filter==='good'?'#fcfaf1':'#d9d6c3'}" stroke="#b5b9a7"/>`;
      if(c.solids(s.vessels.filter)>0)b+=`<path d="M340 104H388L366 132Z" fill="${s.vessels.filter.sand>0.1?'#c4a679':'#e6e5d8'}"/>`;
      if(s.mounted)b+=`<path d="M264 100H315M264 66V230M243 230H284" fill="none" stroke="url(#steel)" stroke-width="6"/>`;
      b+=text(365,54,`Filter: ${s.filter==='good'?'Papier korrekt':s.filter==='bad'?'Papier undicht':'ohne Papier'}`,12,'#33535b','middle')+text(365,212,`Rückstand ${c.total(s.vessels.filter).toFixed(1)} g`,12,'#33535b','middle');
    }
    if(s.id==='K-03'){b+=`<path d="M570 105V70Q570 47 594 47Q618 47 618 70V105" fill="none" stroke="#6e8791" stroke-width="15"/><path d="M570 92V111M618 92V111" stroke="#bd6955" stroke-width="15"/>`+text(594,143,`Eisen ${s.vessels.magnet.iron.toFixed(1)} g`,12,'#33535b','middle');}
    if(s.op){const o=s.op;const extra={filter:[315,130],magnet:[544,105],funnel:[683,85]},source=positions[o.from]||extra[o.from]||[365,100],dest=positions[o.to]||extra[o.to]||[730,100];b+=`<path d="M${source[0]+50} ${source[1]-15} Q440 125 ${dest[0]+50} ${dest[1]-12}" stroke="#4a9d9c" stroke-width="4" stroke-dasharray="4 9" stroke-dashoffset="${-o.elapsed*30}" fill="none"/>`+text(40,32,`${o.mode==='filter'?'Filtrieren':o.mode==='magnet'?'Magnettrennung':'Transfer'} · ${Math.round(o.elapsed/o.duration*100)} %`,13);if(o.mode==='filter')b+=`<path d="M365 188V242" stroke="#6faebd" stroke-width="3" stroke-dasharray="3 9" stroke-dashoffset="${-o.elapsed*20}"/>`;}
    const loss=c.total(s.vessels.waste),vap=s.vessels.vapor.water;b+=text(35,512,`Bilanz: Verlust ${loss.toFixed(1)} g · verdampftes Wasser ${vap.toFixed(1)} g · Wasser zugegeben ${s.addedWater.toFixed(0)} g`,12);return shell(b,`${s.id}: Gefäße mit aktuellen Stoffmengen, Filter und Trennapparatur`);
  }
  function chromatogram(s,mini=false){const base=y=>455-y*3.8;const left=250,pw=s.paper==='narrow'?140:390;let b='';
    b+=`<path d="M214 60H${left+pw+28}V465Q${left+pw+28} 480 ${left+pw+12} 480H230Q214 480 214 465Z" fill="url(#glass)" stroke="#7b9aa0" stroke-width="2"/>`;
    b+=`<rect x="${left}" y="65" width="${pw}" height="390" rx="2" fill="#fffdf4" stroke="#d2cfbe"/>`;
    const front=Math.max(s.level,s.front);if(s.started)b+=`<rect x="${left}" y="${base(front)}" width="${pw}" height="${455-base(front)}" fill="#d9e9e4" opacity=".7"/>`;
    b+=`<rect x="219" y="${base(s.level)}" width="${pw+54}" height="${474-base(s.level)}" fill="${s.washed?'#ae8299':'#77afc8'}" opacity=".4"/>`;
    if(s.line!=='none')b+=`<path d="M${left} ${base(s.baseline)}H${left+pw}" stroke="${s.line==='pen'?'#3561a1':'#8d9290'}" stroke-width="1.6" stroke-dasharray="${s.line==='pen'?'0':'5 3'}"/>`;
    s.lanes.forEach((l,i)=>{const x=left+pw*(i+1)/(s.lanes.length+1);if(!s.started)b+=`<ellipse cx="${x}" cy="${base(s.baseline)}" rx="${3+l.amount*2}" ry="${2+l.amount*1.4}" fill="${l.sample==='blue'?'#246ad3':l.sample==='green'?'#448766':l.sample==='yellow'?'#dec118':l.sample==='purple'?'#71548d':l.sample==='orange'?'#d87d36':'#2e3741'}"/>`;b+=text(x,501,c.samples.find(v=>v.id===l.sample).name.split(' ·')[0],12,'#34545b','middle');});
    c.bands(s).forEach(band=>{const x=band.lane===-1?left+pw/2:left+pw*(band.lane+1)/(s.lanes.length+1);const w=band.lane===-1?pw*.45:13+band.width*2;
      b+=`<ellipse data-band="${band.pigment}" cx="${x}" cy="${base(band.y)}" rx="${w}" ry="${band.width}" fill="${c.pigments[band.pigment].color}" opacity=".7" ${band.width>7?'filter="url(#soft)"':''}/>`;
      if(!mini)b+=text(x+w+4,base(band.y)+3,c.pigments[band.pigment].name.replace('Wasserfester Schwarzanteil','Schwarz'),9);
    });
    if(s.started){b+=`<path d="M${left} ${base(front)}H${left+pw}" stroke="#4a9c9c" stroke-width="2"/>`;b+=text(left+pw+38,base(front)+3,'Front',12);}
    if(s.marked!==null)b+=`<path d="M${left-8} ${base(s.marked)}H${left+pw+8}" stroke="#4c6966" stroke-dasharray="4 3"/>`;
    for(let mm=0;mm<=100;mm+=10)b+=`<path d="M175 ${base(mm)}h${mm%20?8:15}" stroke="#7f9890"/>`+text(165,base(mm)+4,mm,10,'#57746b','end');
    b+=text(171,50,'mm',11)+text(740,90,'PAPIER',11)+text(740,115,s.paper==='wide'?'3 Probenplätze':'1 Probenplatz',12)+text(740,170,'LAUFMITTEL',11)+text(740,195,s.solvent==='water'?'Wasser':'Ethanol/Wasser',12)+text(740,215,s.solvent==='water'?'':'60:40 (Vol.)',12)+text(740,277,'Startlinie',11)+text(740,300,`${s.baseline} mm · ${s.line==='pencil'?'Bleistift':s.line==='pen'?'Kugelschreiber':'fehlt'}`,12);
    if(s.washed)b+=text(450,30,'Punkte ausgewaschen – Farbstoff in der Kammer',14,'#a45943','middle');return shell(b,'Chromatogramm mit tatsächlicher Laufmittelfront und berechneten Farbstoffzonen');
  }
  function distillation(s){let b='';
    // Heizpilz und Kolben links, Kühler im Gefälle zur offenen Vorlage.
    b+=`<path d="M100 371Q100 451 228 451Q295 451 295 371Z" fill="#78948b" stroke="#4c6d66" stroke-width="3"/><rect x="114" y="447" width="171" height="18" rx="4" fill="#3c6058"/>`+text(200,492,'Elektrischer Heizpilz',13,'#33535b','middle');
    if(s.power>0)b+=`<path d="M118 380Q190 430 276 380" fill="none" stroke="#d28e54" stroke-width="7" opacity=".7"/>`;
    if(s.stand)b+=`<path d="M75 58V451M45 451H105M75 197H165M75 118H182" fill="none" stroke="url(#steel)" stroke-width="7"/>`;
    if(s.flask){const h=(s.water+s.ethanol)*.8; b+=`<clipPath id="flaskclip"><path d="M176 190V270A77 77 0 1 0 220 270V190Z"/></clipPath><rect x="119" y="${403-h}" width="160" height="${h}" clip-path="url(#flaskclip)" fill="url(#water)"/>`;
      if(s.vaporRate>0)for(let i=0;i<10;i++)b+=`<circle cx="${160+(i*23)%85}" cy="${390-(s.elapsed*21+i*15)%Math.max(15,h-8)}" r="${2+i%3}" fill="white" opacity=".65"/>`;
      b+=`<path d="M176 190V270A77 77 0 1 0 220 270V190" fill="url(#glass)" stroke="#70949e" stroke-width="2.5"/><path d="M143 328Q133 370 164 386" fill="none" stroke="white" stroke-width="4" opacity=".7"/>`;if(s.stones)b+=`<circle cx="180" cy="398" r="4" fill="#f3efe1"/><circle cx="195" cy="397" r="5" fill="#dedccc"/>`;}
    if(s.head)b+=`<path d="M180 194V113H217V141L340 184L333 205L217 167V194" fill="url(#glass)" stroke="#7299a3" stroke-width="2.5"/>`;
    if(s.thermometer!=='none'){const ty=s.thermometer==='correct'?158:318;b+=`<rect x="193" y="46" width="12" height="${ty-46}" rx="5" fill="#f9fbf6" stroke="#6f8d8f"/><path d="M199 ${ty-5}V${ty-22-s.vaporTemp*.7}" stroke="#b74845" stroke-width="4"/><circle cx="199" cy="${ty}" r="5" fill="#c45d56"/>`;for(let i=0;i<8;i++)b+=`<path d="M201 ${58+i*10}h6" stroke="#647e7a"/>`;}
    if(s.condenser){b+=`<path d="M326 164L648 274L630 325L309 215Z" fill="#b6dbe1" fill-opacity=".4" stroke="#6d99a5" stroke-width="2"/><path d="M327 189L653 301" stroke="#adcbd0" stroke-width="16"/><path d="M327 189L653 301" stroke="#edf7f4" stroke-width="10"/><path d="M653 301L696 317V354" fill="none" stroke="#86aab1" stroke-width="9"/><path d="M350 170L356 142M601 316L597 341" stroke="#80a6b1" stroke-width="11"/>`;
      if(s.hoses!=='none')b+=`<path d="M599 337Q605 402 487 405" fill="none" stroke="${s.flow>0?'#4c9cae':'#8aa5aa'}" stroke-width="8"/><path d="M356 142Q402 52 505 92" fill="none" stroke="#78b6b0" stroke-width="8"/>`;
      b+=text(445,252,'Liebigkühler',13,'#42636b','middle')+text(490,430,s.hoses==='correct'?'Kühlwasser unten hinein ↑':s.hoses==='reverse'?'Kühlwasser falsch herum':'Kühlwasser fehlt',12,'#365e68','middle')+text(508,77,'oben heraus →',11,'#477c79','middle');
    }
    if(s.vaporRate>0){b+=`<path d="M199 253V150L640 301" stroke="#fff" stroke-width="8" stroke-dasharray="10 14" stroke-dashoffset="${-s.elapsed*22}" opacity=".8" fill="none"/>`;if(s.condenseRate>0)b+=`<path d="M696 355V380" stroke="#69a9c4" stroke-width="4" stroke-dasharray="3 9" stroke-dashoffset="${-s.elapsed*32}"/>`;}
    if(s.receiver){const v=c.empty();v.water=s.collected.water+s.collected.ethanol;b+=beaker(v,644,365,'Vorlage',true);}
    b+=text(775,320,'PRÜFSCHALE',11,'#4c7168','middle')+`<path d="M757 374Q802 396 846 374L837 395Q802 410 766 395Z" fill="url(#glass)" stroke="#77939a" stroke-width="2"/>`;
    if(s.sample.water+s.sample.ethanol>0)b+=`<ellipse cx="802" cy="380" rx="30" ry="5" fill="#82b7cc" opacity=".6"/>`;
    if(s.flame)b+=`<path d="M782 376Q767 354 799 321Q797 344 820 354Q832 369 819 381Z" fill="#4382d4" opacity=".7"/><path d="M796 377Q788 362 805 346Q804 362 813 377Z" fill="#9bceee"/>`;
    b+=text(802,439,s.burnResult===true?'brennbar':s.burnResult===false?'keine Flamme':'1 g · separat',12,'#33535b','middle');
    const temp=s.thermometer==='correct'?s.vaporTemp:s.thermometer==='wrong'?s.temp:null;
    b+=`<rect x="575" y="25" width="282" height="94" rx="10" fill="#fff" stroke="#c1d1c9"/>`+text(592,49,s.thermometer==='wrong'?'Kolbenmessung · falsche Position':'Dampftemperatur am Aufsatz',12)+text(592,90,temp===null?'— °C':`${temp.toFixed(1)} °C`,32,'#174f59')+text(840,102,s.thermometer==='correct'?'Dampfweg':'Messung unbrauchbar',10,'#976342','end');
    b+=text(35,520,`Kolben: ${(s.water+s.ethanol).toFixed(1)} g · ${s.temp.toFixed(1)} °C | Dampfverlust: ${(s.lost.water+s.lost.ethanol).toFixed(1)} g`,12);
    return shell(b,'Selbst aufgebauter Destillationsapparat mit Kolben, Thermometer, Kühler, Vorlage und getrennter Prüfschale');
  }
  root.TL.render={classic,chroma:chromatogram,distill:distillation,esc};
})(self);
