"""Build the independent Community executable; never touches the full edition."""
import argparse,os,subprocess,sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=Path('artifacts/windows'));args=p.parse_args()
root=Path(__file__).resolve().parents[1];output=args.output.resolve();output.mkdir(parents=True,exist_ok=True)
cmd=[sys.executable,'-m','PyInstaller','--noconfirm','--clean','--onedir','--windowed','--name','CubeDeskCommunity','--paths',str(root/'src'),'--distpath',str(output),'--workpath',str(output/'work'),'--specpath',str(output/'spec'),'--collect-all','webview','--collect-all','bleak','--collect-submodules','Crypto.Cipher','--add-data',str(root/'web')+os.pathsep+'web','--add-data',str(root/'LICENSE')+os.pathsep+'licenses','--add-data',str(root/'THIRD_PARTY_NOTICES.md')+os.pathsep+'licenses','--add-data',str(root/'third_party')+os.pathsep+'licenses/third_party',str(root/'run.py')]
subprocess.run(cmd,check=True,cwd=root)
