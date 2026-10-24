"""Extracted CubeDesk cubie engine; positions and rotations match the full edition."""
from __future__ import annotations
import re
import math
from dataclasses import dataclass
from .constants import CENTER_OF
FACES = ['U', 'D', 'F', 'B', 'R', 'L']
FACE_N0 = {'U': (0, 1, 0), 'D': (0, -1, 0), 'F': (0, 0, 1), 'B': (0, 0, -1), 'R': (1, 0, 0), 'L': (-1, 0, 0)}
MOVE_SPEC = {'U': ('y', 1, -1), 'D': ('y', -1, 1), 'R': ('x', 1, -1), 'L': ('x', -1, 1), 'F': ('z', 1, -1), 'B': ('z', -1, 1)}

def _rot(v: tuple[int, int, int], axis: str, ang: float) -> list[float]:
    x, y, z = v
    c, s = (math.cos(ang), math.sin(ang))
    if axis == 'x':
        return [x, y * c - z * s, y * s + z * c]
    if axis == 'y':
        return [x * c + z * s, y, -x * s + z * c]
    return [x * c - y * s, x * s + y * c, z]

def _r90(v: tuple[int, int, int], axis: str, times: int=1) -> tuple[int, int, int]:
    out = list(v)
    quarter = math.pi / 2
    for _ in range(times % 4):
        out = _rot(tuple(out), axis, quarter)
    return (int(round(out[0])), int(round(out[1])), int(round(out[2])))

def _face_pos(face: str, a: int, b: int) -> tuple[int, int, int]:
    if face == 'U':
        return (b - 1, 1, a - 1)
    if face == 'D':
        return (b - 1, -1, 1 - a)
    if face == 'F':
        return (b - 1, 1 - a, 1)
    if face == 'B':
        return (1 - b, 1 - a, -1)
    if face == 'R':
        return (1, 1 - a, 1 - b)
    return (-1, 1 - a, b - 1)

@dataclass
class SimCube:
    cubies: list[dict]

    @classmethod
    def solved(cls) -> 'SimCube':
        out = []
        for x in (-1, 0, 1):
            for y in (-1, 0, 1):
                for z in (-1, 0, 1):
                    if x == 0 and y == 0 and (z == 0):
                        continue
                    sticker = {}
                    for f in FACES:
                        n = FACE_N0[f]
                        on_surface = n[0] != 0 and x == n[0] or (n[1] != 0 and y == n[1]) or (n[2] != 0 and z == n[2])
                        sticker[f] = f if on_surface else None
                    out.append({'pos': (x, y, z), 'local': {f: FACE_N0[f] for f in FACES}, 'sticker': sticker})
        return cls(out)

    def turn(self, move: str) -> 'SimCube':
        if not isinstance(move, str) or not re.fullmatch(r"[UDFBRL](?:2|')?", move):
            raise ValueError("Invalid face move")
        face = move[0]
        if face not in MOVE_SPEC:
            return self
        axis, layer, sign = MOVE_SPEC[face]
        prime = "'" in move
        double = move.endswith('2')
        if prime:
            ang_times = -sign % 4
        else:
            ang_times = sign % 4
        if double:
            ang_times = ang_times * 2 % 4
        new = []
        for c in self.cubies:
            d = dict(pos=c['pos'], local=dict(c['local']), sticker=dict(c['sticker']))
            if d['pos'][0 if axis == 'x' else 1 if axis == 'y' else 2] == layer:
                d['pos'] = _r90(d['pos'], axis, ang_times)
                d['local'] = {f: _r90(d['local'][f], axis, ang_times) for f in FACES}
            new.append(d)
        return SimCube(new)

    def facelets(self) -> dict[str, list[int]]:
        by_pos = {c['pos']: c for c in self.cubies}
        out: dict[str, list[int]] = {}
        for face in FACES:
            n = FACE_N0[face]
            cells = []
            for a in range(3):
                for b in range(3):
                    c = by_pos[_face_pos(face, a, b)]
                    color = None
                    for f in FACES:
                        d = c['local'][f]
                        if d == n:
                            color = c['sticker'][f]
                            break
                    cells.append(CENTER_OF[color] if color else -1)
            out[face] = cells
        return out

    def state_key(self) -> tuple:
        return tuple((tuple(v) for v in self.facelets().values()))

def expected_states(moves: list[str]) -> list[SimCube]:
    out = [SimCube.solved()]
    for m in moves:
        out.append(out[-1].turn(m))
    return out
