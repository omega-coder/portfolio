---
title: "INShAck 2019 — You Shall Not Pass (Forensics 330)"
date: 2019-05-05
description: "Extract a hidden port-knocking sequence from an NTFS filesystem image, then implement the knock sequence in Python to unlock a flag service."
tags: ["forensics", "port-knocking", "ntfs", "base64", "gzip", "python", "networking"]
platform: "INShAck"
difficulty: "Hard"
category: "Forensics"
points: 330
author: "Yassine"
draft: false
---

Data extraction from an NTFS image, base64/gzip decoding, and implementing a custom port-knocking sequence in Python.

## Challenge Details

**Category:** Forensics | **Points:** 330 | **Solves:** 11

> One of my friends is a show-off and I don't like that. Help me find the backdoor he just boasted about!
> You'll find an image of his USB key here.

## Phase 1: Data Extraction from NTFS Image

Mount the NTFS image:

```bash
file dd.img
```

![file command output showing NTFS filesystem](https://res.cloudinary.com/https-omega-coder-github-io/image/upload/v1557080003/Screenshot_2019-05-05_19-15-58.png)

```bash
sudo mkdir -p /mnt/you_shall_not_pass
sudo mount -o loop -t ntfs dd.img /mnt/you_shall_not_pass
```

The filesystem contains random text files (Bacon Ipsum) and an LOTR MP4. Hidden data isn't in the normal files.

### Finding the Hidden Data

Running `tail` on the raw image file reveals something suspicious at the end — a Base64 string:

![Base64 encoded string found at end of image](https://res.cloudinary.com/https-omega-coder-github-io/image/upload/v1557081352/Screenshot_2019-05-05_19-38-33.png)

The `H4sI` header is the gzip magic bytes in base64.

### Decoding

```bash
echo "H4sIAOq1yVwAA..." | base64 -d > file.gz
gunzip file.gz
cat file.tar  # Not actually a tar, just JSON
```

The JSON reveals a **port-knocking configuration**:

```json
{
    "door": 20000,
    "sequence": [
        {"port": 10010, "proto": "UDP"},
        {"port": 10090, "proto": "UDP"},
        {"port": 10020, "proto": "TCP"},
        ...
    ],
    "open_sesame": "GIMME THE FLAG PLZ...",
    "seq_interval": 10,
    "door_interval": 5
}
```

## Phase 2: Port Knocking Implementation

Port knocking opens firewall ports by sending packets to a specific sequence of closed ports. After the correct sequence, port 20000 opens.

```python
#!/usr/bin/env python3

import time
import socket
import select
import json

class Knocker:
    def __init__(self, ports_proto, delay=400, host="127.0.0.1", timeout=200):
        self.timeout = timeout / 1000
        self.delay = delay / 1000
        self.ports_proto = ports_proto
        info = socket.getaddrinfo(host=host, port=None, flags=socket.AI_ADDRCONFIG)[0]
        self.address_family = info[0]
        self.ip_address = info[4][0]

    def knock_it(self):
        for i, port_spec in enumerate(self.ports_proto):
            port, proto = port_spec.split(':')
            use_udp = (proto == 'UDP')

            s = socket.socket(
                self.address_family,
                socket.SOCK_DGRAM if use_udp else socket.SOCK_STREAM
            )
            s.setblocking(False)
            addr = (self.ip_address, int(port))

            if use_udp:
                print(f"  [UDP] Knocking {port}")
                s.sendto(b'', addr)
            else:
                print(f"  [TCP] Knocking {port}")
                s.connect_ex(addr)
                select.select([s], [s], [s], self.timeout)

            s.close()
            if i < len(self.ports_proto) - 1:
                time.sleep(self.delay)


if __name__ == '__main__':
    host = "you-shall-not-pass.ctf.insecurity-insa.fr"

    with open("file.tar") as f:
        data = json.load(f)

    ports_proto = [f"{p['port']}:{p['proto']}" for p in data["sequence"]]

    print("[*] Knocking sequence...")
    Knocker(ports_proto, delay=900, host=host).knock_it()

    time.sleep(1)
    print("[*] Connecting to door...")

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect((host, data["door"]))
        s.send(data["open_sesame"].encode())
        flag = s.recv(1024).decode()
        print(f"[+] FLAG: {flag}")
    finally:
        s.close()
```

**Flag:** `INSA{213dca08e606ef9e5352f4bdd8b6dd9d6c559e9ce76b674ae3739a34c5c3be37}`

## Key Takeaways

- **NTFS slack space** and filesystem tails can hide data invisible to normal directory listings
- Port knocking is a legitimate security technique — detecting it requires full packet capture analysis
- Always check raw binary files with `tail`, `strings`, and `binwalk` — hidden data often lives outside the filesystem structure
- The `base64 | gzip` combo is a classic CTF data encoding pattern
