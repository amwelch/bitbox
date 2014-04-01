import redis
import urllib2
import cookielib
import sys

def main(argv):
 
    cookies= cookielib.LWPCookieJar()
    handlers= [urllib2.HTTPHandler(), urllib2.HTTPSHandler(), urllib2.HTTPCookieProcessor(cookies)]
    opener= urllib2.build_opener(*handlers)

    url = "https://blockchain.info/q/24hrprice"
    req= urllib2.Request(url)
    ret = opener.open(req).read()
    print ret
    value = float(ret)
    con = redis.Redis("localhost")
    con.set("bitbox_btc_to_usd", value);

if __name__ == '__main__':
    main(sys.argv)
