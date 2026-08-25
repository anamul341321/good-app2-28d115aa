import json,os,time,urllib.request,concurrent.futures
BS="https://celo.blockscout.com/api"
H={"User-Agent":"curl/8.0"}
RES=os.environ.get('RES','results.jsonl')
addrs=open(os.environ.get('LIST','addrs.txt')).read().split()
done=set()
if os.path.exists(RES):
    for line in open(RES):
        try: done.add(json.loads(line)["a"])
        except Exception: pass
todo=[a for a in addrs if a not in done]
def get(action,a):
    delay=1
    for _ in range(6):
        try:
            req=urllib.request.Request(f"{BS}?module=account&action={action}&address={a}&page=1&offset=100&sort=asc",headers=H)
            j=json.load(urllib.request.urlopen(req,timeout=40))
            r=j.get("result")
            return r if isinstance(r,list) else []
        except Exception:
            time.sleep(delay); delay=min(delay*2,20)
    return None
def one(a):
    nat=get("txlist",a)
    tok=get("tokentx",a)
    if nat is None or tok is None: return None
    out=0; senders=set()
    for t in nat:
        if str(t.get("to","")).lower()==a and str(t.get("from","")).lower()!=a and str(t.get("value","0"))!="0":
            senders.add(str(t.get("from")).lower())
    for t in tok:
        f=str(t.get("from","")).lower(); to=str(t.get("to","")).lower()
        if f==a: out+=1
        elif to==a: senders.add(f)
    return {"a":a,"out":out,"s":sorted(senders)}
f=open(RES,'a')
n=0
with concurrent.futures.ThreadPoolExecutor(3) as ex:
    for d in ex.map(one,todo):
        if d:
            f.write(json.dumps(d)+"\n"); n+=1
            if n%100==0: f.flush(); print("done",n,flush=True)
f.flush()
print("FINISHED",n,"of",len(todo),flush=True)
