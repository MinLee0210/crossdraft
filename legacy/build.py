#!/usr/bin/env python3
"""Inline src/scripts/*.js into src/index.tpl.html and write dist/index.html."""
from pathlib import Path

root = Path(__file__).parent
src = root / "src"
html = (src / "index.tpl.html").read_text()
for marker, name in (("/*__SIM__*/", "sim.js"), ("/*__APP__*/", "app.js")):
    js = (src / "scripts" / name).read_text().replace("</script", "<\\/script")
    assert marker in html, f"missing placeholder {marker}"
    html = html.replace(marker, js)
out = root / "dist" / "index.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html)
print(f"wrote {out} ({len(html)} bytes)")
