#!/usr/bin/env python3
"""Scheduled external link monitor. Writes a static report; never edits games.json."""
import concurrent.futures, datetime, json, os, pathlib, time, urllib.error, urllib.request
from urllib.parse import urlparse
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'static' / 'link-health-report.json'
TIMEOUT = 14

def check(item):
    url = str(item.get('link') or '').strip()
    result = {'id': item.get('id'), 'title': item.get('title'), 'url': url, 'hidden': item.get('hidden') is True}
    if urlparse(url).scheme not in ('https', 'http'):
        return dict(result, status='other', detail='Invalid or missing HTTP URL')

    for attempt in range(2):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; TheGamingEmporiumLinkMonitor/1.0)',
                'Accept': 'text/html,*/*',
            })
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                code, final = r.status, r.url
            return dict(result, status='working' if code < 400 else 'other',
                        detail=f'HTTP {code}', final_url=final)
        except urllib.error.HTTPError as e:
            code = e.code
            # Retry a 404 once to rule out a transient response.
            if attempt == 0:
                time.sleep(2)
                continue
            return dict(result, status='broken' if code == 404 else 'other',
                        detail=f'HTTP {code}')
        except Exception as e:
            if attempt == 0:
                time.sleep(2)
                continue
            return dict(result, status='other', detail=type(e).__name__)

def email_report(new_items, date, results):
    """Send one completion email for every full scan, including zero-new-alert scans."""
    key, recipient, sender = (os.environ.get(k, '').strip() for k in
                              ('RESEND_API_KEY', 'LINK_HEALTH_EMAIL_TO', 'LINK_HEALTH_EMAIL_FROM'))
    if not (key and recipient and sender):
        print('::warning::Confirmation email not sent: missing RESEND_API_KEY, LINK_HEALTH_EMAIL_TO or LINK_HEALTH_EMAIL_FROM secret', flush=True)
        return False
    confirmed = [x for x in results if x['status'] == 'broken']
    pending = [x for x in results if x['status'] == 'monitoring']
    other = [x for x in results if x['status'] == 'other']
    lines = [f'{x["title"]} — {x["detail"]}\n{x["url"]}' for x in new_items[:60]]
    body = (f'The Gaming Emporium — Link Health scan complete\n{date}\n\n'
            f'Links checked: {len(results)}\n'
            f'Confirmed HTTP 404: {len(confirmed)}\n'
            f'Awaiting second scan: {len(pending)}\n'
            f'Other issues (including 403, timeouts): {len(other)}\n'
            f'Newly confirmed broken links: {len(new_items)}\n\n'
            + ('Newly confirmed links:\n\n' + '\n\n'.join(lines) + '\n\n' if lines else
               'No newly confirmed broken links in this scan.\n\n')
            + 'Dashboard: https://thegamingemporium.com/admin/link-health/')
    data = json.dumps({'from': sender, 'to': [recipient],
                       'subject': f'The Gaming Emporium: scan complete — {len(new_items)} new broken links',
                       'text': body}).encode()
    req = urllib.request.Request('https://api.resend.com/emails', data=data,
                                 headers={'Authorization': 'Bearer ' + key,
                                          'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print('Daily confirmation email API status:', r.status, flush=True)
        return True
    except urllib.error.HTTPError as exc:
        # Resend often includes an actionable JSON error message in its response.
        # Never print the API key, and never block publication of scan results.
        detail = exc.read(2048).decode('utf-8', errors='replace')
        print(f'::warning::Confirmation email rejected by Resend (HTTP {exc.code}): {detail}', flush=True)
        return False
    except Exception as exc:
        print(f'::warning::Confirmation email failed ({type(exc).__name__}: {exc})', flush=True)
        return False

def main():
    games = json.loads((ROOT / 'data/games.json').read_text())
    previous = json.loads(OUT.read_text()) if OUT.exists() else {}
    previous_by_id = {str(x['id']): x for x in previous.get('results', [])}
    reviews_path = ROOT / 'static/link-health-reviews.json'
    reviews = json.loads(reviews_path.read_text()) if reviews_path.exists() else {}
    # Avoid repeated checks for duplicate URLs while preserving every game entry.
    by_url = {}
    for game in games:
        by_url.setdefault(str(game.get('link') or ''), []).append(game)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        checked = list(pool.map(check, [group[0] for group in by_url.values()]))
    results = []
    for result, group in zip(checked, by_url.values()):
        for game in group:
            old = previous_by_id.get(str(game.get('id')), {})
            item = dict(result, id=game.get('id'), title=game.get('title'), hidden=game.get('hidden') is True)
            # Count consecutive scans with HTTP 404, including the
            # previous scan's pending status. Other errors reset the counter.
            old_is_missing = str(old.get('detail', '')).startswith('HTTP 404')
            if item['status'] == 'broken':
                item['consecutive_failures'] = (int(old.get('consecutive_failures') or 0) + 1) if old_is_missing else 1
                if item['consecutive_failures'] < 2:
                    item['status'] = 'monitoring'
                    item['detail'] += ' (awaiting next daily check)'
            else:
                item['consecutive_failures'] = 0
            review = reviews.get(str(item['id']), {})
            if review.get('url') == item['url'] and review.get('detail') == item['detail']:
                item['reviewed_ok_at'] = review.get('checked_at')
            results.append(item)
    date = datetime.datetime.now(datetime.timezone.utc).isoformat()
    old_flagged = {str(x['id']) for x in previous.get('results', []) if x.get('status') == 'broken' and not x.get('reviewed_ok_at')}
    new_items = [x for x in results if x['status'] == 'broken' and str(x['id']) not in old_flagged and not x.get('reviewed_ok_at')]
    report = {'checked_at': date, 'total':len(results), 'results':results}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(f'Checked {len(results)} entries; newly flagged {len(new_items)}')
    if not email_report(new_items, date, results):
        print('::warning::Link scan report saved; confirmation email was not delivered. Check the Resend error above.', flush=True)

if __name__ == '__main__': main()
