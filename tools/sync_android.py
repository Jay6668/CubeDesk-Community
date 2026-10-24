"""Copy only this repository's shared core and web files into generated Android inputs."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
for source,destination in [(root/'src/cubedesk_community',root/'android/app/src/main/python/cubedesk_community'),(root/'web',root/'android/app/src/main/assets/web'),(root/'third_party',root/'android/app/src/main/assets/licenses')]:
    if destination.exists():
        if not destination.resolve().is_relative_to(root/'android/app/src/main'):raise RuntimeError('Unexpected destination')
        shutil.rmtree(destination)
    shutil.copytree(source,destination,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
for name in ['LICENSE','THIRD_PARTY_NOTICES.md']:
    shutil.copyfile(root/name,root/'android/app/src/main/assets/licenses'/name)
print('Community Python and web inputs synchronized')
