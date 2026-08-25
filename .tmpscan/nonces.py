import json,urllib.request,concurrent.futures
addrs=open('addrs.txt').read().split()
RPC="https://forno.celo.org"
H={"Content-Type":"application/json","User-Agent":"curl/8.0"}
def batch(sl):
    body=[{"jsonrpc":"2.0","id":i,"method":"eth_getTransactionCount","params":[a,"latest"]} for i,a in enumerate(sl)]
    err=None
    for _ in range(4):
        try:
            req=urllib.request.Request(RPC,data=json.dumps(body).encode(),headers=H)
            r=json.load(urllib.request.urlopen(req,timeout=45))
            return {sl[x["id"]]:int(x.get("result","0x0"),16) for x in r if "result" in x}
        except Exception as e: err=e
    print("fail",repr(err)[:80]); return {}
chunks=[addrs[i:i+50] for i in range(0,len(addrs),50)]
out={}
with concurrent.futures.ThreadPoolExecutor(6) as ex:
    for d in ex.map(batch,chunks): out.update(d)
json.dump(out,open('nonces.json','w'))
print("total",len(addrs),"scanned",len(out),"zero-nonce",sum(1 for v in out.values() if v==0))
