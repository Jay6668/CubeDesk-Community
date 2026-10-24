"""Minimal extraction/adaptation of CubeDesk's guided, first-move solve flow.

The cubie engine is the same extracted implementation as the full edition.
Results freeze at the FIRST solved move, even if later moves share a packet.
"""
import copy
import datetime
import time
import uuid
from ..core.state import SimCube
from ..core.scramble import gen_scramble
from ..core.facelets import from_facelets, is_solved, key, inverse

ACTIVE = {'scrambling','ready','solving'}

class Practice:
    def __init__(self, book, clock=time.monotonic):
        self.book=book;self.clock=clock;self.cube=SimCube.solved()
        self.phase='idle';self.known=False;self.source='none';self.scramble=[]
        self.expected=[];self.progress=0;self.wrong=[];self.moves=[]
        self.result=None;self.started=None;self.last_seq=0;self.epoch=None
        self.baseline=None;self.run_id=None;self.integrity='complete';self.error=''
    def set_source(self,source):
        if source not in {'none','simulation','ble_moyu32'}:raise ValueError('Unknown source')
        if self.phase in ACTIVE:raise ValueError('请先结束当前练习')
        self.source=source;self.known=False;self.last_seq=0;self.epoch=None
    def synchronize(self,faces):
        if self.phase in ACTIVE:raise ValueError('练习中不覆盖魔方状态，请先取消')
        self.cube=from_facelets(faces);self.known=True;self.error=''
    def prepare(self, moves=None):
        if self.phase in ACTIVE:raise ValueError('已有一局正在进行')
        if self.source=='none' or not self.known:raise ValueError('请先连接魔方并取得状态，或明确进入演示模式')
        if not is_solved(self.cube.facelets()):raise ValueError('请先把实体魔方复原；演示模式可重置')
        moves=list(gen_scramble() if moves is None else moves)
        if not 1 <= len(moves) <= 200:raise ValueError('打乱长度不合法')
        cube=self.cube;self.expected=[key(cube.facelets())]
        for move in moves:cube=cube.turn(move);self.expected.append(key(cube.facelets()))
        if is_solved(cube.facelets()):raise ValueError('打乱结果不能是复原状态')
        self.scramble=moves;self.phase='scrambling';self.progress=0;self.wrong=[]
        self.moves=[];self.started=None;self.result=None;self.integrity='complete'
        self.run_id=uuid.uuid4().hex;self.error=''
    def on_move(self,event):
        move=event['move'];at=float(event.get('at',self.clock()))
        if not self.known:return
        # Duplicates and stale connection events never alter geometry or time.
        if 'epoch' in event and self.epoch is not None and event['epoch']!=self.epoch:return
        if 'seq' in event:
            seq=int(event['seq'])
            if seq<=self.last_seq:return
            self.last_seq=seq
        if self.epoch is None:self.epoch=event.get('epoch')
        previous=self.cube
        self.cube=self.cube.turn(move)
        if self.phase=='scrambling':
            signature=key(self.cube.facelets())
            matches=[i for i,s in enumerate(self.expected) if s==signature]
            if matches:
                self.progress=max(matches);self.wrong=[]
            else:self.wrong.append(move)
            if self.progress==len(self.scramble) and not self.wrong:
                self.phase='ready';self.baseline=self.cube.facelets()
            return
        if self.phase=='ready':
            self.started=at;self.phase='solving';self.baseline=previous.facelets()
        if self.phase!='solving':return
        elapsed=max(0,round((at-self.started)*1000))
        self.moves.append(dict(sequence=len(self.moves)+1,move=move,elapsed_ms=elapsed,
            device_delta_ms=event.get('device_delta_ms'),time_source=event.get('time_source','host_monotonic')))
        if is_solved(self.cube.facelets()):self._finish(elapsed)
    def _finish(self, elapsed):
        if self.phase!='solving':return
        turns=sum(2 if m['move'].endswith('2') else 1 for m in self.moves)
        batch=any(m['time_source']=='host_batch' for m in self.moves)
        self.result=dict(schema_version=1,id=self.run_id,source=self.source,
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            time_ms=elapsed,turns_qtm=turns,tps_qtm=round(turns*1000/elapsed,1) if elapsed>0 and self.integrity=='complete' else None,
            outcome='completed',integrity=self.integrity,timestamp_source='host_batch' if batch else 'host_monotonic',
            scramble=list(self.scramble),start_facelets=copy.deepcopy(self.baseline),end_facelets=self.cube.facelets(),moves=copy.deepcopy(self.moves))
        self.phase='finished';self.book.save(self.result)
    def cancel(self,reason='cancelled'):
        if self.phase in ACTIVE:self.error=reason
        self.phase='idle';self.started=None;self.wrong=[]
    def lost(self,reason):
        self.cancel(reason);self.known=False;self.integrity='gap';self.epoch=None;self.last_seq=0
    def snapshot(self):
        elapsed=max(0,round((self.clock()-self.started)*1000)) if self.phase=='solving' else (self.result or {}).get('time_ms',0)
        return dict(phase=self.phase,source=self.source,known=self.known,facelets=self.cube.facelets(),
            scramble=list(self.scramble),progress=self.progress,recovery=inverse(self.wrong),elapsed_ms=elapsed,
            result=copy.deepcopy(self.result),error=self.error,integrity=self.integrity)
