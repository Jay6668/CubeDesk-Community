"""Local Community orchestration, independent of full-edition UI and storage."""
import copy
import threading
import time
from .. import __version__
from ..core.facelets import key,solved_facelets
from ..devices.link import Link
from ..storage.book import Book
from ..timer.practice import Practice,ACTIVE

class App:
    def __init__(self,home,link_factory=Link):
        self.lock=threading.RLock();self.book=Book(home);self.practice=Practice(self.book)
        self.link=link_factory(self.receive);self.cube_epoch=0;self.sequence=0;self.events=[]
        self.skin=self.book.preference('skin','classic');self.closed=False;self.snapshots=0
        self.recent=[self.summary(r) for r in self.book.list()]
        if self.skin not in ('classic','diamond'):self.skin='classic'
    def receive(self,event):
        with self.lock:
            kind=event['kind']
            if kind=='state':
                if self.practice.phase in ACTIVE:return
                self.practice.synchronize(event['facelets']);self.cube_epoch+=1;self.events=[]
            elif kind=='verify':
                if self.practice.known and key(event['facelets'])!=key(self.practice.cube.facelets()):
                    self.practice.lost('设备状态与转动记录不一致，请刷新状态');self.cube_epoch+=1
            elif kind=='move':
                before=key(self.practice.cube.facelets());self.practice.on_move(event)
                if key(self.practice.cube.facelets())!=before:
                    self.sequence+=1;self.events.append(dict(sequence=self.sequence,move=event['move']));self.events=self.events[-256:]
                result=self.practice.result
                if result and (not self.recent or self.recent[0]['id']!=result['id']):self.recent=([self.summary(result)]+self.recent)[:30]
            elif kind in ('gap','disconnect'):
                self.practice.lost(event.get('reason','转动数据不完整，请重新同步'));self.cube_epoch+=1;self.events=[]
    def action(self,action,body=None):
        body=body or {}
        # Release the state lock during scan/connect: notifications need it for handshake.
        if action in ('scan','connect','disconnect','refresh'):
            with self.lock:
                if self.practice.phase in ACTIVE:raise ValueError('请先取消当前练习，再切换连接或同步')
                if action=='connect':self.practice.set_source('ble_moyu32')
                if action=='refresh':self.practice.lost('正在重新同步')
            if action=='scan':return dict(devices=self.link.scan())
            if action=='connect':self.link.connect(str(body.get('id','')),str(body.get('mac','')))
            elif action=='disconnect':self.link.disconnect()
            else:self.link.refresh()
            return self.snapshot()
        if action=='simulation':
            with self.lock:
                if self.practice.phase in ACTIVE:raise ValueError('请先取消当前练习')
            self.link.disconnect()
            with self.lock:
                self.practice.set_source('simulation');self.practice.synchronize(solved_facelets());self.cube_epoch+=1;self.events=[]
            return self.snapshot()
        with self.lock:
            if action=='new_scramble':self.practice.prepare()
            elif action=='cancel':self.practice.cancel('已取消本局')
            elif action=='simulation_reset':
                if self.practice.source!='simulation':raise ValueError('仅演示模式可重置')
                self.practice.cancel();self.practice.synchronize(solved_facelets());self.cube_epoch+=1;self.events=[]
            elif action=='simulation_move':
                if self.practice.source!='simulation':raise ValueError('模拟操作不能影响真实设备成绩')
                self.receive(dict(kind='move',move=str(body.get('move','')),at=time.monotonic(),time_source='host_monotonic'))
            elif action=='skin':
                skin=body.get('value')
                if skin not in ('classic','diamond'):raise ValueError('未知皮肤')
                self.book.set_preference('skin',skin);self.skin=skin
            else:raise ValueError('未知操作')
            return self.snapshot()
    @staticmethod
    def summary(record):
        return {k:record.get(k) for k in ('id','source','created_at','time_ms','turns_qtm','tps_qtm','integrity')}
    def snapshot(self):
        with self.lock:
            self.snapshots+=1
            return dict(snapshot_id=self.snapshots,version=__version__,practice=self.practice.snapshot(),device=self.link.snapshot(),skin=self.skin,
                cube_epoch=self.cube_epoch,sequence=self.sequence,events=copy.deepcopy(self.events),records=copy.deepcopy(self.recent))
    def suspend(self):
        with self.lock:
            if self.practice.phase in ACTIVE:self.practice.cancel('应用进入后台，本局已取消')
    def close(self):
        if self.closed:return
        self.closed=True;self.link.close()
