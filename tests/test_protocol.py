import unittest
from fixtures import *
from cubedesk_community.devices.moyu32 import *

class ProtocolTests(unittest.TestCase):
    def test_cipher_roundtrip_and_read_only_commands(self):
        c=Cipher(MAC)
        for seed in range(20):
            data=bytes((i*17+seed)%256 for i in range(20));self.assertEqual(c.transform(c.transform(data,True)),data)
        self.assertEqual(c.transform(c.command(0xA3)),bytes([0xA3])+bytes(19))
        with self.assertRaises(ValueError):c.command(0xA2)
        with self.assertRaises(ValueError):session_keys('invalid')
    def test_baseline_required(self):
        d=Decoder(MAC);self.assertEqual(d.feed(moves(['R'],1),1),[])
        self.assertEqual(d.feed(snapshot(counter=0),1)[0]['kind'],'state')
    def test_order_duplicates_and_counter_wrap(self):
        d=Decoder(MAC);d.feed(snapshot(counter=254),1)
        packet=moves(['R','U',"F'"],1);r=d.feed(packet,2)
        self.assertEqual([e['move'] for e in r],['R','U',"F'"])
        self.assertEqual([e['serial'] for e in r],[255,0,1]);self.assertEqual(d.feed(packet,3),[])
        self.assertEqual(d.feed(moves(['L'],0),3),[])
    def test_gap_cancels_baseline_without_partial_moves(self):
        d=Decoder(MAC);d.feed(snapshot(),0)
        self.assertEqual(d.feed(moves(['R']*5,6),2)[0]['kind'],'gap');self.assertFalse(d.ready)
        self.assertEqual(d.feed(moves(['U'],7),3),[])
        self.assertEqual(d.feed(snapshot(counter=7),4)[0]['kind'],'state')
    def test_invalid_length_code_and_state(self):
        d=Decoder(MAC);self.assertEqual(d.feed(b'bad',0)[0]['kind'],'packet_error')
        d.feed(snapshot(),0);raw=bytearray(Cipher(MAC).transform(moves(['R'],1)));raw[12]=255
        self.assertEqual(d.feed(encrypt(raw),1)[0]['kind'],'gap')
        raw=bytearray(Cipher(MAC).transform(snapshot()));raw[1]=255
        self.assertEqual(d.feed(encrypt(raw),2)[0]['kind'],'packet_error')
    def test_snapshot_never_overwrites_in_flight(self):
        d=Decoder(MAC);d.feed(snapshot(),0);d.feed(moves(['R'],1),1)
        self.assertEqual(d.feed(snapshot(counter=0),2),[])
        self.assertEqual(d.feed(snapshot(counter=1),2)[0]['kind'],'verify')
