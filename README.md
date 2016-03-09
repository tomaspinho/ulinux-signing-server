# uLinux Signing Server

## Generate RSA key pair for code signing
  openssl genpkey -algorithm RSA -out signing_privkey.pem -pkeyopt rsa_keygen_bits:2048
  openssl rsa -pubout -in signing_privkey.pem -out signing_pubkey.pem
