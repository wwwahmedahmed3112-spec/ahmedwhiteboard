from pathlib import Path
import shutil,zipfile,subprocess,io,hashlib,json
root=Path(__file__).resolve().parents[1]
vendor=b''.join((root/('vendor.zip.part'+str(i))).read_bytes() for i in range(5))
assert hashlib.sha256(vendor).hexdigest() == 'dd769e973adb3e7a6cfe608e59c3e0bc4b2dea5781eccc17da1fb3a3d577d982', 'Vendor integrity check failed'
with zipfile.ZipFile(io.BytesIO(vendor)) as archive:
    archive.extractall(root/'web/vendor')
camera=b''.join((root/('camera-assets.zip.part'+str(i))).read_bytes() for i in range(7))
assert hashlib.sha256(camera).hexdigest() == '96dd0b0627dd3c990b01904e9ba15ad5036d6e62a4aaafb0512a5c723677a79a', 'Camera asset integrity check failed'
with zipfile.ZipFile(io.BytesIO(camera)) as archive:
    archive.extractall(root/'web/camera')
subprocess.run(['node','scripts/build-offline.mjs'],cwd=root,check=True)
shutil.copytree(root/'web',root/'site',dirs_exist_ok=True)
release=json.loads((root/'web/release.json').read_text())
version=release['version']
# Immutable asset URLs keep CDN nodes from combining old modules with new HTML.
snapshot=root/'site/release'/version
shutil.copytree(root/'web',snapshot,dirs_exist_ok=True)
html=(root/'web/index.html').read_text().replace('<head>', '<head><base href="/release/'+version+'/">',1)
(root/'site/index.html').write_text(html)
# A new path also bypasses legacy workers and an old CDN-cached homepage.
fresh=html.replace('<head>', '<head><script>history.replaceState(null,"","/");</script>',1)
(root/'site'/release['entry']).write_text(fresh)
(snapshot/'index.html').write_text(fresh)
(root/'site'/('sw-'+version+'.js')).write_bytes((root/'web/sw.js').read_bytes())
print('Ready: site/index.html; fresh entry: '+release['entry'])
