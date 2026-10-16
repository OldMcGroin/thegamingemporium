#!/usr/bin/env python3
"""Check that baseline-critical source files have not silently disappeared or changed."""
import hashlib, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[1]
manifest=json.loads((root/'tools/source_preservation_manifest.json').read_text(encoding='utf-8'))
missing=[];changed=[]
for relative, expected in manifest['sha256'].items():
    path=root/relative
    if not path.is_file(): missing.append(relative)
    elif hashlib.sha256(path.read_bytes()).hexdigest()!=expected: changed.append(relative)
print(f"Checked {len(manifest['sha256'])} baseline-critical files.")
if missing:
    print('MISSING (restore or explicitly approve removal):')
    for p in missing: print('  -',p)
if changed:
    print('CHANGED (review against the current baseline; intentional edits are OK):')
    for p in changed: print('  -',p)
if not missing and not changed: print('All protected files match the supplied baseline.')
if missing: sys.exit(2)
if changed: sys.exit(1)
