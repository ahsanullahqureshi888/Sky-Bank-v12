import json
import os
import urllib.request

tree_file = r"C:\Users\HomePC\.gemini\antigravity\brain\860af232-ff68-4384-81e3-b8f60d4367e0\.system_generated\steps\136\content.md"

with open(tree_file, "r", encoding="utf-8") as f:
    text = f.read()

json_start = text.find("{")
data = json.loads(text[json_start:])

tree = data.get("tree", [])

ignored_prefixes = (".npm-cache/", "_uv/", ".codeboarding/")
ignored_extensions = (".zip", ".rar", ".exe", ".bin", ".tar", ".gz")

count = 0
skipped = 0
for item in tree:
    path = item["path"]
    item_type = item["type"]
    
    if any(path.startswith(prefix) for prefix in ignored_prefixes):
        continue
    if any(path.endswith(ext) for ext in ignored_extensions):
        skipped += 1
        continue
        
    if item_type == "tree":
        os.makedirs(path, exist_ok=True)
    elif item_type == "blob":
        if os.path.exists(path) and os.path.getsize(path) > 0:
            count += 1
            continue
            
        dir_name = os.path.dirname(path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
            
        raw_url = f"https://raw.githubusercontent.com/ahsanullahqureshi888/Sky-Bank-v12/main/{path}"
        print(f"Downloading [{count+1}]: {path}...", flush=True)
        try:
            req = urllib.request.Request(raw_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as resp, open(path, "wb") as out_file:
                out_file.write(resp.read())
            count += 1
        except Exception as e:
            print(f"Failed {path}: {e}", flush=True)

print(f"Done! Downloaded/processed {count} code files. Skipped {skipped} binaries.", flush=True)
