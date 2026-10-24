"""Small isolated SQLite store. No full-edition databases, accounts or media."""
import json
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path

class Book:
    def __init__(self, home):
        self.home=Path(home);self.home.mkdir(parents=True,exist_ok=True)
        self.path=self.home/'practice.sqlite3';self.lock=threading.RLock()
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS solves(id TEXT PRIMARY KEY, source TEXT NOT NULL, created TEXT NOT NULL, payload TEXT NOT NULL)')
            db.execute('CREATE TABLE IF NOT EXISTS preferences(key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    @contextmanager
    def connect(self):
        db=sqlite3.connect(self.path, timeout=5)
        try:
            with db:yield db
        finally:db.close()
    def save(self, record):
        payload=json.dumps(record,ensure_ascii=False,allow_nan=False)
        if len(payload.encode('utf-8')) > 1_000_000:raise ValueError('Record is too large')
        with self.lock,self.connect() as db:
            result=db.execute('INSERT OR IGNORE INTO solves VALUES(?,?,?,?)',(record['id'],record['source'],record['created_at'],payload))
            return result.rowcount==1
    def list(self, limit=30):
        with self.lock,self.connect() as db:
            rows=db.execute('SELECT payload FROM solves ORDER BY rowid DESC LIMIT ?', (max(1,min(int(limit),10000)),)).fetchall()
            return [json.loads(r[0]) for r in rows]
    def get(self, identity):
        with self.lock,self.connect() as db:
            row=db.execute('SELECT payload FROM solves WHERE id=?',(identity,)).fetchone()
            return json.loads(row[0]) if row else None
    def preference(self, key, default=None):
        with self.lock,self.connect() as db:
            row=db.execute('SELECT value FROM preferences WHERE key=?',(key,)).fetchone()
            return json.loads(row[0]) if row else default
    def set_preference(self,key,value):
        if key not in {'skin','scramble_length'}:raise ValueError('Unknown preference')
        with self.lock,self.connect() as db:
            db.execute('INSERT OR REPLACE INTO preferences VALUES(?,?)',(key,json.dumps(value)))
