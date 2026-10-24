"""Restricted MoYu32 protocol adapter, no radio or disk side effects.

Public MoYu32 fields/crypto cross-checked against MIT smartcube-web-bluetooth
(Pau Oliva / Andy Fedotov). Duplicate/counter handling is extracted from CubeDesk.
No official application binaries, SDK, binding, reset or firmware writes.
"""
import re
from ..core.facelets import validate_facelets

SERVICE = '0783b03e-7735-b5a0-1760-a305d2795cb0'
NOTIFY = '0783b03e-7735-b5a0-1760-a305d2795cb1'
WRITE = '0783b03e-7735-b5a0-1760-a305d2795cb2'
# Public protocol parameters, not account credentials or a user/device secret.
BASE_KEY = bytes.fromhex('15773a5c670e2d1f17672a139b675257')
BASE_IV = bytes.fromhex('11232625862a2c3b55067f317e672157')
MOVES = ('F',"F'",'B',"B'",'U',"U'",'D',"D'",'L',"L'",'R',"R'")

def normalize_mac(value):
    value = str(value).upper().replace('-', ':')
    if not re.fullmatch(r'(?:[0-9A-F]{2}:){5}[0-9A-F]{2}', value):
        raise ValueError('需要有效的六字节魔方 MAC 地址')
    return value

def session_keys(mac):
    salt = bytes.fromhex(normalize_mac(mac).replace(':', ''))[::-1]
    key, iv = bytearray(BASE_KEY), bytearray(BASE_IV)
    for i in range(6):
        key[i] = (key[i] + salt[i]) % 255
        iv[i] = (iv[i] + salt[i]) % 255
    return bytes(key), bytes(iv)

def aes_block(block, key, iv, encrypt):
    from Crypto.Cipher import AES
    cipher = AES.new(key, AES.MODE_CBC, iv)
    return cipher.encrypt(block) if encrypt else cipher.decrypt(block)

class Cipher:
    def __init__(self, mac, block=aes_block):
        self.key, self.iv = session_keys(mac); self.block = block
    def transform(self, packet, encrypt=False):
        if len(packet) != 20: raise ValueError('MoYu32 packet must be exactly 20 bytes')
        data = bytearray(packet)
        for offset in ([0, 4] if encrypt else [4, 0]):
            data[offset:offset+16] = self.block(bytes(data[offset:offset+16]), self.key, self.iv, encrypt)
        return bytes(data)
    def command(self, opcode):
        if opcode not in (0xA1, 0xA3, 0xA4): raise ValueError('Only read/init commands are exposed')
        return self.transform(bytes([opcode])+bytes(19), True)

class Decoder:
    """Counter-ordered events; host monotonic time is authoritative.

    A3 snapshots seed a session. Subsequent snapshots only verify the matching
    counter, so an old snapshot cannot replay a turn or stop a running timer.
    """
    def __init__(self, mac, block=aes_block):
        self.cipher = Cipher(mac, block); self.counter = None
        self.ready = False; self.epoch = 0; self.sequence = 0
        self.parse_errors = 0; self.packets = 0
    def begin_resync(self):
        self.counter = None; self.ready = False
    def feed(self, packet, at):
        self.packets += 1
        try:
            data = self.cipher.transform(packet)
            typ = data[0]
            if typ == 0xA1:
                return [{'kind':'info', 'model':data[1:9].decode('ascii', 'ignore').strip('\0 ')}]
            if typ == 0xA4:
                if data[1] > 100: raise ValueError('Invalid battery')
                return [{'kind':'battery','battery':data[1]}]
            if typ == 0xA3:
                bits = int.from_bytes(data[1:19], 'big')
                colours = [(bits >> (141-3*i)) & 7 for i in range(48)]
                faces = {}
                for i,f in enumerate('FBUDLR'):
                    cells=colours[i*8:i*8+8];faces[f]=cells[:4]+[i]+cells[4:]
                faces=validate_facelets(faces); serial=data[19]
                if not self.ready:
                    self.ready=True;self.counter=serial
                    return [{'kind':'state','facelets':faces,'serial':serial}]
                if serial == self.counter:
                    return [{'kind':'verify','facelets':faces,'serial':serial}]
                return []
            if typ != 0xA5 or not self.ready:return []
            serial=data[11];delta=(serial-self.counter)&255
            if delta == 0 or delta >= 128:return []
            value=int.from_bytes(data[12:17], 'big')
            codes=[(value>>(35-5*i))&31 for i in range(5)]
            offsets=[int.from_bytes(data[1+2*i:3+2*i], 'big') for i in range(5)]
            if delta > 5 or any(code >= len(MOVES) for code in codes[:min(delta,5)]):
                self.begin_resync()
                return [{'kind':'gap','at':at,'reason':'missing_or_invalid_turns'}]
            self.counter=serial;out=[]
            for i in range(delta-1, -1, -1):
                self.sequence+=1
                out.append(dict(kind='move',move=MOVES[codes[i]],seq=self.sequence,
                    serial=(serial-i)&255,epoch=self.epoch,at=at,device_delta_ms=offsets[i],
                    time_source='host_batch' if delta>1 else 'host_monotonic'))
            return out
        except (ValueError, IndexError, TypeError, OverflowError):
            self.parse_errors += 1
            return [{'kind':'packet_error','reason':'invalid_packet'}]
