import random
import unittest
from cubedesk_community.core.state import SimCube
from cubedesk_community.core.facelets import *
from cubedesk_community.core.scramble import gen_scramble

class CoreTests(unittest.TestCase):
    def test_identity_and_inverses(self):
        for f in 'URFDLB':
            c=SimCube.solved()
            for _ in range(4): c=c.turn(f)
            self.assertTrue(is_solved(c.facelets()))
            self.assertTrue(is_solved(c.turn(f+'2').turn(f+'2').facelets()))
            self.assertTrue(is_solved(c.turn(f).turn(f+"'").facelets()))
    def test_random_reconstruction_and_legal_states(self):
        random.seed(7241)
        for _ in range(30):
            moves=gen_scramble();c=SimCube.solved()
            for move in moves:
                c=c.turn(move);validate_facelets(c.facelets())
            clone=from_facelets(c.facelets())
            for move in inverse(moves): c=c.turn(move);clone=clone.turn(move)
            self.assertEqual(c.facelets(),clone.facelets());self.assertTrue(is_solved(c.facelets()))
    def test_invalid_states(self):
        for mode in ('count','edgeflip','cornertwist','parity','center'):
            f=solved_facelets()
            if mode=='count':f['F'][0]=1
            if mode=='edgeflip':f['U'][5],f['R'][1]=f['R'][1],f['U'][5]
            if mode=='cornertwist':f['U'][8],f['R'][0],f['F'][2]=f['R'][0],f['F'][2],f['U'][8]
            if mode=='parity':f['R'][1],f['F'][1]=f['F'][1],f['R'][1]
            if mode=='center':f['F'][4],f['B'][4]=f['B'][4],f['F'][4]
            with self.subTest(mode=mode),self.assertRaises(ValueError):validate_facelets(f)
    def test_bad_turn_does_not_mutate(self):
        c=SimCube.solved()
        for move in ('X','R3','Rw','',"U''"):
            with self.assertRaises(ValueError):c.turn(move)
        self.assertTrue(is_solved(c.facelets()))
    def test_replay_history(self):
        h=replay(solved_facelets(),['R','U',"U'","R'"])
        self.assertEqual(len(h),5);self.assertTrue(is_solved(h[-1]));self.assertFalse(is_solved(h[1]))
