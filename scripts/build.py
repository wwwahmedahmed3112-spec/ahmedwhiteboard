from pathlib import Path
import shutil,zipfile,subprocess,io,hashlib
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
print('Ready: site/index.html')
