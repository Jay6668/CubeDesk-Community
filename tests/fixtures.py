from cubedesk_community.devices.moyu32 import Cipher,MOVES
from cubedesk_community.core.facelets import solved_facelets
MAC='02:00:00:00:00:01'  # Synthetic locally administered address; never a capture.
def encrypt(data):return Cipher(MAC).transform(bytes(data),True)
def snapshot(faces=None,counter=0):
    faces=faces or solved_facelets();colours=[v for f in 'FBUDLR' for i,v in enumerate(faces[f]) if i!=4]
    bits=0
    for v in colours:bits=(bits<<3)|v
    return encrypt(bytes([0xA3])+bits.to_bytes(18,'big')+bytes([counter]))
def moves(sequence,counter):
    # Wire stores latest turn first, in the high five bits of each slot.
    data=bytearray(20);data[0]=0xA5;data[11]=counter;bits=0
    newest=list(reversed(sequence))[:5]
    for i in range(5):bits=(bits<<5)|(MOVES.index(newest[i]) if i<len(newest) else 0)
    data[12:17]=(bits<<15).to_bytes(5,'big')
    for i in range(5):data[1+2*i:3+2*i]=(80+i).to_bytes(2,'big')
    return encrypt(data)
