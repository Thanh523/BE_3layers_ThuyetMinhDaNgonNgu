import re, sqlite3, json, hashlib, secrets, unicodedata
from pathlib import Path
from fastapi import FastAPI, HTTPException, Header
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

HERE = Path(__file__).parent
DB = HERE / "echo.db"
app = FastAPI(title="Sài Gòn Echo API")

def db():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row; return c

def init():
    c = db()
    c.executescript("""
    create table if not exists users(id integer primary key, username text unique, pw text, salt text);
    create table if not exists sessions(token text primary key, user_id int);
    create table if not exists places(id text primary key, data text);
    create table if not exists favorites(user_id int, place_id text, primary key(user_id, place_id));
    create table if not exists history(id integer primary key, user_id int, place_id text, lang text, kind text, time text default current_timestamp);""")
    if not c.execute("select 1 from places").fetchone():
        for p in json.load(open(HERE / "seed.json", encoding="utf-8")):
            c.execute("insert into places values(?,?)", (p["id"], json.dumps(p, ensure_ascii=False)))
    c.commit(); c.close()
init()

def norm(s):
    s = unicodedata.normalize("NFD", s.lower().replace("đ", "d"))
    return "".join(ch for ch in s if unicodedata.category(ch) != "Mn")

def hash_pw(pw, salt): return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 100_000).hex()

def user_id(authorization):
    if not authorization or not authorization.startswith("Bearer "): raise HTTPException(401, "Cần đăng nhập")
    r = db().execute("select user_id from sessions where token=?", (authorization[7:],)).fetchone()
    if not r: raise HTTPException(401, "Phiên đăng nhập không hợp lệ")
    return r["user_id"]

class Cred(BaseModel): username: str; password: str
class Listen(BaseModel): place_id: str; lang: str; kind: str = "tts"

def normalize_identifier(value):
    value = value.strip()
    if "@" in value:
        return value.lower()
    return re.sub(r"[\s().-]", "", value)

def valid_identifier(value):
    return bool(re.fullmatch(r"\+?[0-9]{9,15}", value) or re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value))

def token_for(c, uid):
    t = secrets.token_hex(24); c.execute("insert into sessions values(?,?)", (t, uid)); c.commit(); return t

# ---- Người dùng: xem / tìm kiếm / chi tiết (a, b, c) ----
@app.get("/api/places")
def places(q: str = "", category: str = "all"):
    out = []
    for r in db().execute("select data from places"):
        p = json.loads(r["data"])
        if not p.get("published", True): continue
        if category != "all" and p["category"] != category: continue
        if norm(q) not in norm(p["name"] + " " + p["enName"] + " " + p["address"]): continue
        out.append(p)
    return out

@app.get("/api/places/{pid}")
def place(pid: str):
    r = db().execute("select data from places where id=?", (pid,)).fetchone()
    if not r: raise HTTPException(404, "Địa điểm không tồn tại")
    return json.loads(r["data"])

# ---- Quét QR (f): giải mã SGECHO:<id> / URL có #place=<id> ----
@app.get("/api/qr/resolve")
def resolve(code: str):
    code = code.strip()
    pid = code[7:] if code.startswith("SGECHO:") else code.split("place=")[-1] if "place=" in code else code
    return place(pid)

# ---- Tài khoản (g, h) ----
@app.post("/api/register")
def register(c: Cred):
    identifier = normalize_identifier(c.username)
    if not valid_identifier(identifier): raise HTTPException(400, "Nhập email hợp lệ hoặc số điện thoại từ 9 đến 15 số")
    if len(c.password) < 6: raise HTTPException(400, "Mật khẩu phải có ít nhất 6 ký tự")
    salt = secrets.token_hex(8); con = db()
    try: cur = con.execute("insert into users(username,pw,salt) values(?,?,?)", (identifier, hash_pw(c.password, salt), salt))
    except sqlite3.IntegrityError: raise HTTPException(409, "Email hoặc số điện thoại đã được đăng ký")
    return {"token": token_for(con, cur.lastrowid), "username": identifier}

@app.post("/api/login")
def login(c: Cred):
    identifier = normalize_identifier(c.username)
    con = db(); u = con.execute("select * from users where username=?", (identifier,)).fetchone()
    if not u or u["pw"] != hash_pw(c.password, u["salt"]): raise HTTPException(401, "Sai tên đăng nhập hoặc mật khẩu")
    return {"token": token_for(con, u["id"]), "username": u["username"]}

# ---- Yêu thích (h) ----
@app.get("/api/favorites")
def favs(authorization: str = Header(None)):
    return [r["place_id"] for r in db().execute("select place_id from favorites where user_id=?", (user_id(authorization),))]

@app.put("/api/favorites/{pid}")
def fav_add(pid: str, authorization: str = Header(None)):
    c = db(); c.execute("insert or ignore into favorites values(?,?)", (user_id(authorization), pid)); c.commit(); return {"ok": True}

@app.delete("/api/favorites/{pid}")
def fav_del(pid: str, authorization: str = Header(None)):
    c = db(); c.execute("delete from favorites where user_id=? and place_id=?", (user_id(authorization), pid)); c.commit(); return {"ok": True}

# ---- Lịch sử nghe (e, g) ----
@app.post("/api/history")
def hist_add(l: Listen, authorization: str = Header(None)):
    c = db(); c.execute("insert into history(user_id,place_id,lang,kind) values(?,?,?,?)", (user_id(authorization), l.place_id, l.lang, l.kind)); c.commit(); return {"ok": True}

@app.get("/api/history")
def hist(authorization: str = Header(None)):
    return [dict(r) for r in db().execute("select id,place_id,lang,kind,time from history where user_id=? order by id desc limit 200", (user_id(authorization),))]

@app.delete("/api/history")
def hist_clear(authorization: str = Header(None)):
    c = db(); c.execute("delete from history where user_id=?", (user_id(authorization),)); c.commit(); return {"ok": True}

dist = HERE.parent / "frontend" / "dist"
if dist.exists(): app.mount("/", StaticFiles(directory=dist, html=True), name="web")
