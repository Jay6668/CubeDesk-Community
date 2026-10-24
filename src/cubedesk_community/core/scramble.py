"""Training move-sequence scrambles, not WCA random-state scrambles."""
import random
FACES = ['U', 'D', 'L', 'R', 'F', 'B']
SUFFIX = ['', "'", '2']
AXIS = {'U': 'D', 'D': 'U', 'L': 'R', 'R': 'L', 'F': 'B', 'B': 'F'}

def gen_scramble(n: int=20, rng: random.Random | None=None) -> list[str]:
    r = rng or random
    out: list[str] = []
    while len(out) < n:
        f = r.choice(FACES)
        if out:
            last = out[-1][0]
            if f == last:
                continue
            if len(out) >= 2 and f == out[-2][0] and (AXIS.get(f) == last):
                continue
        out.append(f + r.choice(SUFFIX))
    return out

def scramble_text(moves: list[str]) -> str:
    return ' '.join(moves)
