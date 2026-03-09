---
title: "Securinets CTF 2019 — Lost Flag (Exploiting Bazaar VCS)"
date: 2019-03-26
description: "Discover a hidden Bazaar VCS repository on a web server, clone it, and revert to a previous revision to recover a deleted flag file."
tags: ["vcs", "bazaar", "web", "forensics", "directory-discovery", "ctf"]
platform: "Securinets"
difficulty: "Easy"
category: "Web/Forensics"
points: 994
author: "Yassine"
draft: false
---

A web challenge where the flag was deleted but recoverable through version control history.

## Challenge Details

**Category:** Forensics/Web | **Points:** 994 | **Solves:** 19

> Help me get back my flag!

## Reconnaissance

Login with `admin/admin` — we're in, but the flag is gone. Standard directory enumeration with `dirsearch`:

```bash
python3 dirsearch.py -u https://web8.ctfsecurinets.com/ -e php,html,txt
```

Discovery: `/.bzr/README` — a **Bazaar** version control repository is exposed!

## What is Bazaar?

Bazaar (bzr) is a distributed version control system similar to git. Exposing `.bzr/` is equivalent to exposing `.git/` — it leaks the entire commit history.

## Extracting the Repository

```bash
bzr branch -Ossl.cert_reqs=none https://web8.ctfsecurinets.com/
```

Note: use `bzr branch`, not `bzr clone`.

## Examining History

```bash
bzr log
```

![bzr log output showing two revisions](https://res.cloudinary.com/https-omega-coder-github-io/image/upload/v1554052445/bzr_log_lost_flag.png)

Output shows two revisions:
- **Revision 2**: "flag deleted"
- **Revision 1**: Original commit with the flag

## Recovering the Flag

```bash
bzr revert -r 1
```

This restores all files to revision 1, bringing back `flag.php`.

**Flag:** `Securinets{BzzzzzzzzZzzzzzzzzzZrR_roCk$}`

## Key Takeaways

- **Never expose `.git/`, `.svn/`, `.bzr/`, or `.hg/` directories** to the web — they leak full source history
- Use your web server config to block access to version control metadata directories:

```nginx
# nginx
location ~ /\.(git|svn|bzr|hg)/ {
    deny all;
    return 404;
}
```

```apache
# Apache
RedirectMatch 404 /\.(git|svn|bzr|hg)
```

- Tools like [GitDumper](https://github.com/internetwache/GitTools) and [dvcs-ripper](https://github.com/kost/dvcs-ripper) automate VCS extraction — pentesters should always check for these
