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


def github_tree_images(repo_url):
    m = re.match(r'https://github[.]com/([^/]+)/([^/#?]+)', repo_url)
    if not m:
        return []
    owner, repo = m.groups()
    api = f'https://api.github.com/repos/{owner}/{repo}'
    info = json.loads(get(api))
    branch = info['default_branch']
    tree_url = api + '/git/trees/' + urllib.parse.quote(branch, safe='') + '?recursive=1'
    tree = json.loads(get(tree_url))
    results = []
    for item in tree.get('tree', []):
        if item.get('type') != 'blob':
            continue
        path = item['path']
        low = path.lower()
        if not low.endswith(('.png', '.jpg', '.jpeg', '.webp')):
            continue
        if any(x in low for x in ('icon', 'logo', 'badge', 'banner', 'button', 'sprite', 'texture', 'font', 'tile', 'asset/')):
            continue
        if not any(x in low for x in ('screenshot', 'gameplay', 'screen', 'preview', 'image', 'media', 'docs/')):
            continue
        url = 'https://raw.githubusercontent.com/' + owner + '/' + repo + '/' + urllib.parse.quote(branch, safe='') + '/' + urllib.parse.quote(path, safe='/')
        results.append({
            'url': url,
            'source_page': repo_url,
            'license': 'Check project license / image rights',
            'attribution': owner,
            'title': path,
            'source': 'GitHub repository image'
        })
    results.sort(key=lambda x: (
        not any(k in x['title'].lower() for k in ('gameplay', 'screenshot')),
        len(x['title'])
    ))
    return results[:12]


def brave_images(game, query):
    key = os.environ.get('BRAVE_API_KEY')
    if not key:
        raise RuntimeError('BRAVE_API_KEY secret is missing')

    params = urllib.parse.urlencode({
        'q': query,
        'count': 40,
        'safesearch': 'strict',
        'spellcheck': 'false'
    })

    req = urllib.request.Request(
        'https://api.search.brave.com/res/v1/images/search?' + params,
        headers={
            'Accept': 'application/json',
            'X-Subscription-Token': key,
            'User-Agent': UA
        }
    )

    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.load(response)

    words = re.findall(r'[a-z0-9]+', game.lower())
    results = []

    for item in data.get('results', []):
        title = item.get('title') or ''
        page = item.get('url') or ''
        image_url = (item.get('properties') or {}).get('url')
        thumbnail = (item.get('thumbnail') or {}).get('src')

        searchable = urllib.parse.unquote(title + ' ' + page).lower()
        tokens = set(re.findall(r'[a-z0-9]+', searchable))

        if not all(word in tokens for word in words):
            continue

        if any(x in searchable for x in (
            'painting', 'butterfly', 'wallpaper',
            'stock photo', 'fan art', 'fanart'
        )):
            continue

        if game.lower() == 'defender':
            if not any(x in searchable for x in (
                'arcade', 'atari', 'falcon', 'gameplay',
                'video game', 'videogame', 'screenshot'
            )):
                continue

        if not image_url and not thumbnail:
            continue

        results.append({
            'url': image_url or thumbnail,
            'fallback_url': thumbnail,
            'source_page': page,
            'license': 'Rights not verified — review before publishing',
            'attribution': item.get('source') or 'Unknown',
            'title': title,
            'source': 'Brave Image Search'
        })

    print(f'{game}: {len(results)} relevant search results')
    return results[:12]

def render(data, dest):
    dest.mkdir(parents=True,exist_ok=True)
    report=[]
    for idx,e in enumerate(data['entries'],1):
        game=re.sub(r' (Recompilation|PC Port|Linux Port|Atari ST/Falcon Port|Port)$','',e['title'])
        queries=[f'{game} {e["platform"]} gameplay']
        if 'Defender' in game:queries.insert(0,'Defender Atari ST Falcon gameplay')
        sources=[]
        try:sources+=github_images(e['link'])
        except Exception as ex:print('README search:', type(ex).__name__, str(ex)[:160])
        try:sources+=github_tree_images(e['link'])
        except Exception:pass
        queries += [f'{game} screenshot', f'{game} video game']
        try:
            sources += brave_images(game, queries[0])
        except Exception as ex:
            raise RuntimeError(
                f'Brave image search failed for {game}: '
                f'{type(ex).__name__}: {ex}'
            ) from ex
        saved=[]; seen=set()
        for s in sources:
            if not s.get('url') or s['url'] in seen:continue
            seen.add(s['url'])
            try:
                try:
                    raw = get(s['url'], 'image/*')
                except Exception:
                    if not s.get('fallback_url'):
                        continue
                    raw = get(s['fallback_url'], 'image/*')
                im=Image.open(io.BytesIO(raw))
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
