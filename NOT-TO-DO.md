# NOT-TO-DO

| Datum | Tag | Fehler | Vermeidung |
|-------|-----|--------|------------|
| 2026-09-08 | git,js | Heredoc-Append (`cat >>`) an CRLF-Datei erzeugt gemischte Zeilenenden | Neue Bloecke per Edit-Tool einfuegen oder danach auf CRLF normalisieren; `git ls-files --eol` pruefen |
| 2026-09-08 | electron | `npx electron .` startet als Node (`app` undefined), weil `ELECTRON_RUN_AS_NODE=1` in der Shell-Umgebung steht | Vor App-Start `unset ELECTRON_RUN_AS_NODE` |
