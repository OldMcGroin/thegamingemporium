#!/usr/bin/env python3
"""Stage genuine candidate artwork for human review; never publishes to site."""
import argparse, io, json, os, re, time, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

UA='GamingEmporiumArtworkReview/1.0 (GitHub Actions; image attribution in manifest)'
def get(url, accept='application/json', max_bytes=12_000_000):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':accept})
    with urllib.request.urlopen(req,timeout=22) as r:
        if int(r.headers.get('Content-Length','0'))>max_bytes: raise ValueError('too large')
        data=r.read(max_bytes+1)
        if len(data)>max_bytes: raise ValueError('too large')
        return data

def commons(q):
    params={'action':'query','generator':'search','gsrsearch':q+' filetype:bitmap','gsrnamespace':6,'gsrlimit':8,'prop':'imageinfo','iiprop':'url|extmetadata|size','iiurlwidth':1000,'format':'json'}
    url='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params)
    pages=json.loads(get(url)).get('query',{}).get('pages',{})
    results=[]
    for p in pages.values():
        for i in p.get('imageinfo',[]):
            ext=i.get('extmetadata',{})
            results.append({'url':i.get('thumburl') or i.get('url'),'source_page':i.get('descriptionurl'),'license':re.sub('<[^>]*>','',ext.get('LicenseShortName',{}).get('value','')),'attribution':re.sub('<[^>]*>','',ext.get('Artist',{}).get('value',''))[:250], 'title':p.get('title',''),'source':'Wikimedia Commons'})
    return results

def github_images(repo_url):
    m=re.match(r'https://github\.com/([^/]+)/([^/#?]+)',repo_url)
    if not m:return []
    owner,repo=m.groups()
    api=f'https://api.github.com/repos/{owner}/{repo}/readme'
    try:
        doc=json.loads(get(api))
        import base64
        readme=base64.b64decode(doc['content']).decode('utf-8','replace')
    except Exception:return []
    images=re.findall(r'!\[[^]]*\]\(([^)]+)\)|<img[^>]+src=["\']([^"\']+)',readme,re.I)
    results=[]
    for a,b in images:
        src=(a or b).split(' ')[0].strip('<>')
        if src.startswith('data:'):continue
        if src.startswith('https://'):url=src
        elif src.startswith('http://'):continue
        elif src.startswith('/'):url=f'https://raw.githubusercontent.com/{owner}/{repo}/HEAD{src}'
        else:url=f'https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{src.lstrip("./")}'
        if not any(x in url.lower() for x in ['.png','.jpg','.jpeg','.webp','user-attachments','githubusercontent']):continue
        results.append({'url':url,'source_page':repo_url,'license':'Check project license / image rights','attribution':owner,'title':'Project README image','source':'GitHub project README'})
    return results[:10]

def render(data, dest):
    dest.mkdir(parents=True,exist_ok=True)
    report=[]
    for idx,e in enumerate(data['entries'],1):
        game=re.sub(r' (Recompilation|PC Port|Linux Port|Atari ST/Falcon Port|Port)$','',e['title'])
        queries=[f'{game} {e["platform"]} gameplay']
        if 'Defender' in game:queries.insert(0,'Defender Atari ST Falcon gameplay')
        sources=[]
        try:sources+=github_images(e['link'])
        except Exception:pass
        for q in queries:
            try:sources+=commons(q)
            except Exception:pass
        saved=[]; seen=set()
        for s in sources:
            if not s.get('url') or s['url'] in seen:continue
            seen.add(s['url'])
            try:
                im=Image.open(io.BytesIO(get(s['url'],'image/*')))
                im.load()
                if im.width<240 or im.height<180:continue
                im=ImageOps.exif_transpose(im).convert('RGB')
                # Preserve full screenshot without distortion, letterbox to square.
                thumb=ImageOps.contain(im,(600,600),Image.Resampling.LANCZOS)
                canvas=Image.new('RGB',(600,600),(15,18,24))
                canvas.paste(thumb,((600-thumb.width)//2,(600-thumb.height)//2))
                filename=f'{idx:02d}-{re.sub("[^a-z0-9]+","-",game.lower()).strip("-")}-option-{len(saved)+1}.webp'
                canvas.save(dest/filename,'WEBP',quality=92,method=6)
                saved.append({**s,'file':filename,'original_dimensions':[im.width,im.height]})
                if len(saved)>=3:break
            except Exception:continue
        report.append({'title':e['title'],'genre':e.get('genre1'),'platform':e['platform'],'project':e['link'],'search_queries':queries,'candidates':saved,'status':'REVIEW REQUIRED' if saved else 'NO VERIFIED DOWNLOAD; MANUAL SOURCE NEEDED'})
        print(f'{game}: {len(saved)} candidates')
    (dest/'manifest.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
    cards=[]
    from html import escape
    for entry in report:
        imgs=''.join(f'<figure><img src="{escape(s["file"])}"><figcaption>{escape(s["source"])} · {escape(s["license"])}<br><a href="{escape(s["source_page"] or "#")}">Source / attribution</a></figcaption></figure>' for s in entry['candidates']) or '<p>No image downloaded; review manually.</p>'
        cards.append(f'<section><h2>{escape(entry["title"])}</h2><p>Genre: {escape(str(entry["genre"]))} · Platform: Arcade</p><p>{escape(entry["status"])}</p><div class="grid">{imgs}</div></section>')
    (dest/'index.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Artwork review — not published</title><style>body{background:#10141b;color:#eee;font:16px system-ui;margin:20px;max-width:1000px}section{border-bottom:1px solid #555;padding:16px 0}.grid{display:flex;gap:12px;flex-wrap:wrap}figure{margin:0;width:220px}img{width:100%;border-radius:8px}figcaption{font-size:12px;overflow-wrap:anywhere}a{color:#7db9ff}</style><h1>Arcade artwork — review only</h1><p>These are unapproved candidates, not automatically validated gameplay or cleared for reuse. Check the game, license and image before publishing.</p>'+''.join(cards))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',default='imports/arcade-batch-001.json');p.add_argument('--output',default='artwork-review/arcade-batch-001');a=p.parse_args()
    render(json.loads(Path(a.input).read_text()),Path(a.output))
