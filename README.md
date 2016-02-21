# uLinux Signing Server

## Generate RSA key pair for code signing
  # choose a random passphrase and keep it
  gpg --gen-key

  gpg --export-secret-keys --output signing_privkey.gpg -a [chosen e-mail]

  gpg --export --output signing_pubkey.gpg -a [chosen e-mail]
