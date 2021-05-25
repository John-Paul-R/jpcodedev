
. .ports
node ./http2server2.1.js -p $static --pubpath ../public_static --log simple --maxAge 0 --static --host "static.jpcode.dev"
#node --inspect http2server2.0.js -p 8084 --debug --pubpath ../public_static --log simple -k ./credentials/server.key -c ./credentials/server.crt --maxAge 0
