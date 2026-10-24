"""Canonical facelets, legal-state validation and reconstruction of the extracted engine.

Cubie facelet indexing follows the MIT smartcube-web-bluetooth convention.
See THIRD_PARTY_NOTICES.md for the upstream notice and pinned source.
"""
from collections import Counter
from .constants import CENTER_OF, FACE_ORDER
from .state import SimCube, FACES, _face_pos

CORNER_MAP = ((8,9,20),(6,18,38),(0,36,47),(2,45,11),(29,26,15),(27,44,24),(33,53,42),(35,17,51))
EDGE_MAP = ((5,10),(7,19),(3,37),(1,46),(32,16),(28,25),(30,43),(34,52),(23,12),(21,41),(50,39),(48,14))

def solved_facelets():
    return {face: [colour] * 9 for face, colour in CENTER_OF.items()}

def is_solved(faces):
    return isinstance(faces, dict) and set(faces) == set(FACES) and all(
        isinstance(faces[f], list) and len(faces[f]) == 9 and faces[f] == [CENTER_OF[f]] * 9 for f in FACES)

def key(faces):
    return tuple(v for f in FACE_ORDER for v in faces[f])

def _parity(seq):
    return sum(seq[i] > seq[j] for i in range(len(seq)) for j in range(i+1, len(seq))) % 2

def validate_facelets(faces):
    if not isinstance(faces, dict) or set(faces) != set(FACES):
        raise ValueError("魔方面状态必须包含 U D F B R L 六面")
    if any(not isinstance(faces[f], list) or len(faces[f]) != 9 for f in FACES):
        raise ValueError("每面必须有九个贴纸")
    values = key(faces)
    if any(type(x) is not int or not 0 <= x <= 5 for x in values) or Counter(values) != Counter({i: 9 for i in range(6)}):
        raise ValueError("颜色编号或数量不合法")
    if any(faces[f][4] != CENTER_OF[f] for f in FACES):
        raise ValueError("请使用白上、绿前的固定颜色坐标")
    letters = ''.join(next(f for f,c in CENTER_OF.items() if c == n) for n in values)
    corner_colours = [tuple(FACE_ORDER[i // 9] for i in part) for part in CORNER_MAP]
    edge_colours = [tuple(FACE_ORDER[i // 9] for i in part) for part in EDGE_MAP]
    cp, co, ep, eo = [], [], [], []
    for part in CORNER_MAP:
        colours = tuple(letters[i] for i in part)
        orientations = [j for j,c in enumerate(colours) if c in 'UD']
        if len(orientations) != 1:
            raise ValueError("角块颜色不合法")
        ori = orientations[0]
        identity = next((j for j,c in enumerate(corner_colours) if c[1] == colours[(ori+1)%3] and c[2] == colours[(ori+2)%3]), None)
        if identity is None: raise ValueError("角块排列不合法")
        cp.append(identity); co.append(ori)
    for part in EDGE_MAP:
        colours = tuple(letters[i] for i in part)
        if colours in edge_colours: ep.append(edge_colours.index(colours)); eo.append(0)
        elif colours[::-1] in edge_colours: ep.append(edge_colours.index(colours[::-1])); eo.append(1)
        else: raise ValueError("棱块颜色不合法")
    if len(set(cp)) != 8 or len(set(ep)) != 12 or sum(co)%3 or sum(eo)%2 or _parity(cp) != _parity(ep):
        raise ValueError("魔方状态不可达：块重复、方向或奇偶性异常")
    return {f: list(faces[f]) for f in FACES}

def from_facelets(faces):
    faces = validate_facelets(faces)
    cube = SimCube.solved(); by_pos = {c['pos']: c for c in cube.cubies}
    inverse_colours = {v:k for k,v in CENTER_OF.items()}
    for f in FACES:
        for i, colour in enumerate(faces[f]):
            by_pos[_face_pos(f, i//3, i%3)]['sticker'][f] = inverse_colours[colour]
    return cube

def inverse(moves):
    return [m if m.endswith('2') else m[:-1] if m.endswith("'") else m+"'" for m in reversed(moves)]

def replay(start, moves):
    cube = from_facelets(start); history = [cube.facelets()]
    for move in moves:
        cube = cube.turn(move); history.append(cube.facelets())
    return history
