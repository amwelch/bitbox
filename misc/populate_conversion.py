import redis
import urllib2
import cookielib
import sys
import json

def main(argv):
 
    cookies= cookielib.LWPCookieJar()
    handlers= [urllib2.HTTPHandler(), urllib2.HTTPSHandler(), urllib2.HTTPCookieProcessor(cookies)]
    opener= urllib2.build_opener(*handlers)

    url = "https://blockchain.info/q/24hrprice"
    req= urllib2.Request(url)
    ret = opener.open(req).read()
    value = float(ret)
    con = redis.Redis("localhost")
    con.set("bitbox_btc_to_usd", value);

    url ="http://openexchangerates.org/api/latest.json?app_id=ee635f35bdf94a18933928920ac012ca"
    req = urllib2.Request(url)
    ret = json.loads(opener.open(req).read())
    ret = ret["rates"]
   
    rs = {}

    rs["bitbox_usd_to_ca"]= ret["CAD"]
    rs["bitbox_usd_to_eu"]= ret["EUR"]
    rs["bitbox_usd_to_uk"]= ret["GBP"]
    rs["bitbox_usd_to_au"]= ret["AUD"]
    rs["bitbox_usd_to_mx"]= ret["MXN"]
    rs["bitbox_usd_to_br"]= ret["BRL"]
    rs["bitbox_usd_to_ar"]= ret["ARS"]
    rs["bitbox_usd_to_jp"]= ret["JPY"]
    rs["bitbox_usd_to_ch"]= ret["CNY"]
    con.set("bitbox_usd_to_other", json.dumps(rs))

if __name__ == '__main__':
    main(sys.argv)
