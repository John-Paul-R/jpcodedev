#!/bin/bash

# Handles creation of development certificates (more relevant when this only
# supported http2)

mkdir -p ./certs

cd ./certs

openssl req -x509 -newkey rsa:4096 -nodes -new -sha512 -subj '/CN=localhost' \
  -keyout ./localhost-privkey.pem -out ./localhost-cert.pem 

# Create an x509 v3 extention file, so we can trust this dev cert on our local
# machine

openssl x509 -outform pem -in ./localhost-cert.pem -out ca.crt

cat > v3.ext <<-EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names 
[alt_names]
# Local hosts
DNS.1 = localhost
DNS.2 = 127.0.0.1
DNS.3 = ::1 
# List your domain names here
# DNS.4 = local.dev
# DNS.5 = my-app.dev
# DNS.6 = local.some-app.dev
EOF

openssl req -new -nodes -newkey rsa:4096 \
  -keyout localhost.key -out localhost.csr \
  -subj "/C=US/ST=Homeland/L=Hometown/O=jpcodedev/CN=localhost"

openssl x509 -req -sha512 -days 365 \
  -extfile v3.ext \
  -CA ca.crt -CAkey ./localhost-privkey.pem -CAcreateserial \
  -in localhost.csr \
  -out localhost.crt

certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n jpcodedev-local -i ./ca.crt

