const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');const c=require('../../js/chemistry.js'),L=require('../../js/lab.js');
test('SVG IDs stay unique across previews and live scene; no button ID collision',()=>{
  const self={TL:{chem:c}};vm.runInNewContext(fs.readFileSync(require.resolve('../../js/render.js'),'utf8'),{self});
  const html=self.TL.render.classic(c.classic('K-01'))+self.TL.render.chroma(c.chroma())+self.TL.render.distill(c.distill());
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);a.equal(new Set(ids).size,ids.length);a.ok(!ids.includes('water'));
});
test('A small liquid amount cannot generate a negative SVG rectangle',()=>{const self={TL:{chem:c}};vm.runInNewContext(fs.readFileSync(require.resolve('../../js/render.js'),'utf8'),{self});const s=c.classic('K-02');s.vessels.dish.water=.1;const svg=self.TL.render.classic(s);a.doesNotMatch(svg,/height="-/);});
test('Hot closed apparatus is intercepted even after switching heater off',()=>{const s=c.distill();s.temp=80;c.actDistill(s,'setup',{vent:false});a.ok(s.stop.includes('Heiße Apparatur'));a.equal(s.power,0);});
test('Chromatography zone count is tied to actually observed sample',()=>{const s=L.state();L.select(s,'C');const m=s.models.C;c.actChroma(m,'configure',{positioned:true});c.actChroma(m,'spot',{sample:'blue',amount:1});c.actChroma(m,'start');for(let i=0;i<1200;i++)c.tickChroma(m,.05);c.actChroma(m,'stop');s.drafts.C={observation:'success',terms:['mobile','stationäre','Adsorption'],zones:'3'};a.equal(L.evaluate(s),false);s.drafts.C.zones='1';a.equal(L.evaluate(s),true);});
