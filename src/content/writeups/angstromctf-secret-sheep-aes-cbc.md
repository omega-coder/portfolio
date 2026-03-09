---
title: "AngstromCTF 2019 — Secret Sheep Society (AES CBC Bit-Flipping)"
date: 2019-04-24
description: "AES-CBC bit-flipping attack to forge a session cookie and escalate privileges from regular user to admin."
tags: ["crypto", "aes-cbc", "bit-flipping", "python", "web", "cookies"]
platform: "AngstromCTF"
difficulty: "Medium"
category: "Crypto"
points: 120
author: "Yassine"
draft: false
---

A classic AES-CBC bit-flipping attack used to forge admin session tokens.

## Challenge Details

**Category:** Crypto | **Points:** 120 | **Solves:** 98

### TL;DR

1. Identify the AES-CBC session structure
2. Obtain a valid token with a crafted handle
3. Flip specific bits in the IV to change `false` → `true ` in the admin field
4. Send the forged token to get the flag

## Understanding the Application

Three routes:
- `/` — shows flag if `admin: true` in session
- `/enter` — accepts `handle`, creates `token = base64(IV + AES_CBC(session_json))`
- `/exit` — clears the token cookie

The session JSON format:

```json
{"admin": false, "handle": "xx"}
```

The `pack()` method:

```python
def pack(self, session):
    cipher = AES.new(self.key, AES.MODE_CBC)
    iv = cipher.iv
    dec = json.dumps(session).encode()
    enc = cipher.encrypt(pad(dec, self.BLOCK_SIZE))
    return base64.b64encode(iv + enc)
```

Key observation: **the IV is the first 16 bytes of the base64-decoded token** — and it's not encrypted.

## The Attack

AES-CBC decryption scheme — flipping a bit in the IV flips the same bit in the first plaintext block:

![AES CBC Decryption Scheme](https://res.cloudinary.com/https-omega-coder-github-io/image/upload/v1556110161/601px-cbc_decryption-svg.png)

With `handle = "xx"`, the plaintext is exactly 32 bytes (2 blocks):

```
Block 0: {"admin": false,
Block 1:  "handle": "xx"}
```

In AES-CBC decryption:
```
P[0] = AES_DEC(C[0]) XOR IV
```

So flipping a bit in the IV flips the corresponding bit in P[0].

![CBC Byte Flip Attack](https://res.cloudinary.com/https-omega-coder-github-io/image/upload/v1556114028/082113_1459_cbcbyteflip3.jpg)

We want to change `false` (offset 10-14 in block 0) to `true ` (with trailing space):

| Offset | Original | Target |
|--------|----------|--------|
| 10 | `f` | `t` |
| 11 | `a` | `r` |
| 12 | `l` | `u` |
| 13 | `s` | `e` |
| 14 | `e` | ` ` |

## Full Exploit

```python
import requests
from base64 import b64encode, b64decode
import re

URL = "https://secretsheepsociety.2019.chall.actf.co/"
session = requests.Session()
token_exp = re.compile(r'token=(.*);')

# Step 1: Get a token with handle="xx"
req = session.post(URL + "enter", data={"handle": "xx"},
                   verify=False, allow_redirects=False)
token = None
if req.status_code == 302:
    m = re.search(token_exp, req.headers["Set-Cookie"])
    if m:
        token = m.group(1)
        print(f"[+] Token: {token}")

# Step 2: Flip bits in the IV to change false → true
if token:
    ct = list(b64decode(token))
    flips = [(10, 'f', 't'), (11, 'a', 'r'), (12, 'l', 'u'),
             (13, 's', 'e'), (14, 'e', ' ')]
    for offset, orig, target in flips:
        ct[offset] ^= ord(orig) ^ ord(target)
    forged_token = b64encode(bytes(ct)).decode()
    print(f"[+] Forged token: {forged_token}")

# Step 3: Use forged token to get the flag
session2 = requests.Session()
req2 = session2.get(URL, cookies={"token": forged_token})
flag_m = re.search(r'actf\{.*?\}', req2.text)
if flag_m:
    print(f"[+] FLAG: {flag_m.group(0)}")
```

**Flag:** `actf{shep_the_conqueror_slumbers}`

## Why It Works

In CBC mode decryption:

```
P[i] = AES_DEC(C[i]) XOR C[i-1]
```

For block 0, `C[-1]` is the IV. By XOR-ing `IV[j]` with `orig XOR target`, we flip exactly the right bit in the plaintext without affecting other blocks. The ciphertext block itself becomes garbled, but since we only care about block 0, that's acceptable.

### Mitigation

- Use **authenticated encryption** (AES-GCM or AES-CCM) instead of CBC — it detects tampering
- **Sign** session cookies with HMAC in addition to encrypting them
- Never place sensitive boolean flags where they can be bit-flipped
