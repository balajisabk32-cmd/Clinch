import re, pathlib
src = pathlib.Path("api/routers.py").read_text(encoding="utf-8")
lines = src.split("\n")
dec = re.compile(r'^@(\w+)\.(get|post|put|patch|delete)\("([^"]+)"')
rows = []
i = 0
while i < len(lines):
    m = dec.match(lines[i])
    if m:
        # collect the decorator + signature block
        j = i
        depth_body = []
        while j < len(lines) and not re.match(r"^\s*(\"\"\"|[a-z_]+ =|return|rows =|try:|if |for )", lines[j]) or j == i:
            depth_body.append(lines[j]); j += 1
            if j - i > 14: break
        block = "\n".join(depth_body)
        guarded = ("Depends(require" in block or "Depends(current_user" in block
                   or "Depends(any_of" in block or "Depends(get_current_user" in block
                   or "Depends(require_" in block)
        rows.append((m.group(2).upper(), m.group(3), m.group(1), guarded, i + 1))
    i += 1
PUBLIC_OK = {"/health", "/_status", "/events/stream"}
print(f"{'':2}{'METHOD':7}{'PATH':38}{'ROUTER':14}GUARD")
bad = 0
for meth, path, router, guarded, ln in rows:
    if guarded: tag = "ok"
    elif router == "portal" or path in PUBLIC_OK: tag = "public-by-design"
    else: tag = "*** UNGUARDED ***"; bad += 1
    print(f"  {meth:7}{path:38}{router:14}{tag}  L{ln}")
print(f"\n{bad} endpoints reachable without a token that should not be.")
