"""A deliberately small, in-process extension seam. No dynamic plugin discovery."""
from ..core.facelets import replay

def state_history(record):
    """Return start + each accepted move's state, using the same core engine."""
    return replay(record['start_facelets'], [row['move'] for row in record['moves']])

def analyze(record, analyzer):
    """A developer-supplied callable receives only one own solve and its states."""
    if record.get('integrity') != 'complete':raise ValueError('Incomplete move records cannot be analyzed reliably')
    return analyzer(record, state_history(record))
