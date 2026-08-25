import json,sys,time,urllib.request,concurrent.futures,os
BS="https://celo.blockscout.com/api"
H={"User-Agent":"curl/8.0"}
addrs=open('addrs.txt').read().split()
start=int(sys.argv[1]); end=int(sys.argv[2])
addrs=addrs[start:end]
def get(action,a):
    for _ in range(4):
        try:
            req=urllib.request.Request(f"{BS}?module=account&action={action}&address={a}&page=1&offset=100&sort=asc",headers=H)
            j=json.load(urllib.request.urlopen(req,timeout=40))
            r=j.get("result")
            return r if isinstance(r,list) else []
        except Exception:
            time.sleep(1)
    return None
def one(a):
    nat=get("txlist",a); tok=get("tokentx",a)
    if nat is None or tok is None: return a,None
    out=0; senders=set()
    for t in nat:
        if str(t.get("to","")).lower()==a and str(t.get("from","")).lower()!=a and str(t.get("value","0"))!="0":
            senders.add(str(t.get("from")).lower())
    for t in tok:
        f=str(t.get("from","")).lower(); to=str(t.get("to","")).lower()
        if f==a: out+=1
        elif to==a: senders.add(f)
    return a,{"out":out,"senders":sorted(senders)}
res={}
t0=time.time()
with concurrent.futures.ThreadPoolExecutor(4) as ex:
    for a,d in ex.map(one,addrs):
        if d is not None: res[a]=d
fn=f"bs_{start}_{end}.json"
json.dump(res,open(fn,'w'))
print(fn,"ok",len(res),"of",len(addrs),"in",round(time.time()-t0,1),"s")
