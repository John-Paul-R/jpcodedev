nodemon --inspect --watch ../public_static --watch ./ ./http2server2.1.js -p 8084 --debug --pubpath ../public_static --maxAge 0 --log simple --host "static.jpcode.dev"
#node --inspect http2server2.0.js -p 8084 --debug --pubpath ../public_static --log simple -k ./credentials/server.key -c ./credentials/server.crt --maxAge 0