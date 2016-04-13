# uLinux Signing Server

## Installation

Run the following command
  npm install

Make a copy of the `config.js.example` file and name it as `config.js`, make all
the necessary changes.

Use the instructions in the following section to generate keys for image signing
### Generate RSA key pair for code signing
    openssl genpkey -algorithm RSA -out signing_privkey.pem -pkeyopt rsa_keygen_bits:2048
    openssl rsa -pubout -in signing_privkey.pem -out signing_pubkey.pem


Install docker and build the image from this
[repository](https://github.com/ulinux-embedded/ulinux-keymgmt-container) and
name it after whatever you choose in the `config.js` file.

Create a `container_files/` folder or whichever name you chose and insert in it:

  - a copy of the devices' certificates CA folder, named `device_ca`
  - a copy of the signing public key, named as `signing_pubkey.pem`
  - a copy of the servers CA's certificate, named as `servers_ca.crt`

This folder is used by the docker container to alter your images and insert any
required files in it.
