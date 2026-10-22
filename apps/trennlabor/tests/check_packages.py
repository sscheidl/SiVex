"""Prüft die wirklich ausgelieferten Bytes und extrahiert nur sichere relative Pfade."""
from pathlib import Path, PurePosixPath
import hashlib, json, re, zipfile, xml.etree.ElementTree as ET

app=Path(__file__).resolve().parents[1]
out=app/'build'/'package-check'
out.mkdir(parents=True,exist_ok=True)
report=[]
for line in (app/'release'/'SHA256SUMS.txt').read_text().splitlines():
    checksum,name=line.split()
    p=app/'release'/name
    assert hashlib.sha256(p.read_bytes()).hexdigest()==checksum, name+' checksum'
    with zipfile.ZipFile(p) as z:
        assert z.testzip() is None
        for item in z.namelist():
            parts=PurePosixPath(item)
            assert not parts.is_absolute() and '..' not in parts.parts
        scorm='scorm12' in name
        target=out/('scorm' if scorm else 'web')
        target.mkdir(exist_ok=True)
        z.extractall(target)
        root=target if scorm else target/'trennlabor'
        assert (root/'index.html').is_file()
        for relative in ['index.html','sivex.json','css/app.css','js/chemistry.js','js/lab.js','js/render.js','js/ui.js','js/scorm.js']:
            assert (root/relative).read_bytes()==(app/relative).read_bytes(), relative+' differs from current branch source'
        for rel in re.findall(r'(?:src|href)="([^"]+)"',(root/'index.html').read_text(encoding='utf-8')):
            if rel.startswith('data:'):continue
            assert not rel.startswith(('/', 'http:', 'https:'))
            assert (root/rel).is_file(), rel
        if scorm:
            m=ET.fromstring(z.read('imsmanifest.xml'))
            ns={'i':'http://www.imsproject.org/xsd/imscp_rootv1p1p2','a':'http://www.adlnet.org/xsd/adlcp_rootv1p2'}
            assert m.find('i:metadata/i:schemaversion',ns).text=='1.2'
            resource=m.find('i:resources/i:resource',ns)
            assert resource.attrib['{'+ns['a']+'}scormtype']=='sco'
            assert resource.attrib['href']=='index.html'
            listed={f.attrib['href'] for f in resource.findall('i:file',ns)}
            assert listed==set(z.namelist())-{'imsmanifest.xml'}
            assert all((root/f).is_file() for f in listed)
        report.append({'package':name,'sha256':checksum,'crc':'PASS','relative_resources':'PASS','manifest':'PASS' if scorm else None})
(out/'lms.html').write_text('''<!doctype html><html lang="de"><title>Simuliertes SCORM-1.2-LMS</title><script>
window.calls=[];window.API={};for(const name of ['LMSInitialize','LMSFinish','LMSSetValue','LMSGetValue','LMSCommit'])API[name]=function(){calls.push(name);return 'true'};
</script><style>body{margin:0}iframe{display:block;width:100%;height:100vh;border:0}</style><iframe id="sco" src="scorm/index.html" title="Trennlabor"></iframe></html>''',encoding='utf-8')
(out/'opener.html').write_text('''<!doctype html><html lang="de"><title>LMS Neues Fenster</title><script>
window.calls=[];window.API={LMSInitialize(){calls.push('LMSInitialize');return 'true'},LMSFinish(){calls.push('LMSFinish');return 'true'},LMSSetValue(){calls.push('LMSSetValue');return 'true'}};
</script><a href="scorm/index.html" target="_blank" rel="opener">Lernpaket in neuem Fenster öffnen</a></html>''',encoding='utf-8')
(app/'tests'/'e2e'/'package-integrity.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('PASS: ZIP CRC, SHA256, relative Ressourcen, SCORM-Manifest, sichere Extraktion für beide Pakete')
