import tempfile
import unittest
from cubedesk_community.timer.practice import Practice
from cubedesk_community.storage.book import Book
from cubedesk_community.core.facelets import solved_facelets,is_solved
from cubedesk_community.analysis.extensions import state_history,analyze

class TimerTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.now=10.;self.book=Book(self.tmp.name)
        self.p=Practice(self.book,lambda:self.now);self.p.set_source('simulation');self.p.synchronize(solved_facelets())
    def tearDown(self):self.tmp.cleanup()
    def turn(self,m,dt=.1,**kw):self.now+=dt;self.p.on_move(dict(move=m,at=self.now,**kw))
    def test_full_cycle_and_first_solved_freeze(self):
        self.p.prepare(['R','U']);self.turn('R');self.turn('U');self.assertEqual(self.p.phase,'ready')
        self.turn("U'");self.turn("R'",1.234);first=self.p.result.copy();self.turn('F',0)
        self.assertEqual(self.p.phase,'finished');self.assertEqual(self.p.result,first)
        self.assertEqual(first['time_ms'],1234);self.assertEqual(first['turns_qtm'],2)
        self.assertEqual(len(self.book.list()),1);self.assertFalse(is_solved(self.p.cube.facelets()))
        self.assertTrue(is_solved(state_history(first)[-1]));self.assertEqual(analyze(first,lambda r,h:len(h)),3)
    def test_continuous_wrong_turns(self):
        self.p.prepare(['R','U']);self.turn('R');self.turn('F');self.turn('L')
        self.assertEqual(self.p.snapshot()['recovery'],["L'","F'"])
        self.turn("L'");self.turn("F'");self.assertEqual(self.p.progress,1);self.assertEqual(self.p.wrong,[])
        self.turn('U');self.assertEqual(self.p.phase,'ready')
    def test_duplicate_stale_epoch_and_batch(self):
        self.p.prepare(['R']);self.turn('R',seq=1,epoch=4);self.turn("R'",seq=1,epoch=4)
        self.assertEqual(self.p.phase,'ready');self.turn("R'",seq=2,epoch=3);self.assertEqual(self.p.phase,'ready')
        self.turn("R'",seq=2,epoch=4,time_source='host_batch');self.assertEqual(self.p.result['timestamp_source'],'host_batch')
        self.assertIsNone(self.p.result['tps_qtm'])
    def test_disconnect_gap_and_cancel_never_save(self):
        for phase in ('scrambling','ready','solving'):
            self.p.synchronize(solved_facelets());self.p.prepare(['R','U'])
            if phase!='scrambling':self.turn('R');self.turn('U')
            if phase=='solving':self.turn('F')
            self.p.lost('gap');self.assertFalse(self.p.known);self.assertEqual(self.p.phase,'idle')
        self.assertEqual(self.book.list(),[])
    def test_restart_record_and_preference(self):
        self.p.prepare(['R','U']);self.turn('R');self.turn('U');self.turn("U'");self.turn("R'")
        self.book.set_preference('skin','diamond');other=Book(self.tmp.name)
        self.assertEqual(other.preference('skin','classic'),'diamond');self.assertEqual(len(other.list()),1)
        self.assertFalse(other.save(self.p.result));self.assertEqual(len(other.list()),1)
        fresh=Practice(other);self.assertEqual(fresh.phase,'idle');self.assertFalse(fresh.known)
