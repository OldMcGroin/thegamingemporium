<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom">

  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title><xsl:value-of select="rss/channel/title"/></title>
        <style>
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; background: #0b0b0c; color: #e9e9ea; }
          a { color: #ffd54a; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .wrap { max-width: 960px; margin: 0 auto; padding: 24px; }
          .card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px 18px; }
          h1 { margin: 0 0 8px; font-size: 26px; }
          .desc { margin: 0; opacity: 0.85; }
          .hint { margin-top: 10px; opacity: 0.75; font-size: 14px; }
          ul { list-style: none; padding: 0; margin: 16px 0 0; }
          li { padding: 14px 0; border-top: 1px solid rgba(255,255,255,0.08); }
          li:first-child { border-top: none; }
          .title { font-weight: 700; font-size: 16px; }
          .meta { margin-top: 4px; opacity: 0.7; font-size: 12px; }
          .snippet { margin-top: 6px; opacity: 0.85; font-size: 13px; }
          code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 8px; }
        
          .copy-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:10px; }
          .copy-btn { background:#151517; color:#e9e9ea; border:1px solid rgba(255,255,255,0.14); border-radius:999px; padding:10px 14px; font-weight:600; cursor:pointer; }
          .copy-btn:hover { border-color: rgba(255,255,255,0.24); }
          .copy-status { color: rgba(233,233,234,0.8); font-size: 0.95rem; }
          .note { margin: 10px 0 0 0; color: rgba(233,233,234,0.75); }

        </style>
      
        <script>
          function copyRssUrl() {
            var url = (window.location.origin || '').replace(/\/$/, '') + '/rss.xml';
            var status = document.getElementById('copyStatus');
            function ok() { if(status){ status.textContent = 'Copied!'; setTimeout(function(){ status.textContent=''; }, 1500);} }
            function fail() { if(status){ status.textContent = 'Copy failed'; setTimeout(function(){ status.textContent=''; }, 2000);} }
            if (navigator.clipboard &amp;&amp; navigator.clipboard.writeText) {
              navigator.clipboard.writeText(url).then(ok).catch(function(){
                try {
                  var ta = document.createElement('textarea');
                  ta.value = url; ta.style.position='fixed'; ta.style.left='-9999px';
                  document.body.appendChild(ta); ta.select();
                  var success = document.execCommand('copy');
                  document.body.removeChild(ta);
                  success ? ok() : fail();
                } catch(e){ fail(); }
              });
            } else {
              try {
                var ta2 = document.createElement('textarea');
                ta2.value = url; ta2.style.position='fixed'; ta2.style.left='-9999px';
                document.body.appendChild(ta2); ta2.select();
                var success2 = document.execCommand('copy');
                document.body.removeChild(ta2);
                success2 ? ok() : fail();
              } catch(e2){ fail(); }
            }
          }
        </script>

      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <h1><xsl:value-of select="rss/channel/title"/></h1>
            <p class="desc"><xsl:value-of select="rss/channel/description"/></p>
            <p class="hint">
              This is an RSS feed (XML). Use a feed reader to subscribe.
              You can copy this URL: <code>/rss.xml</code>.
            </p>
          </div>

          <ul>
            <xsl:for-each select="rss/channel/item">
              <li>
                <div class="title">
                  <a href="{link}"><xsl:value-of select="title"/></a>
                </div>
                <div class="meta"><xsl:value-of select="pubDate"/></div>
                <div class="snippet"><xsl:value-of select="description"/></div>
              </li>
            </xsl:for-each>
          </ul>
        </div>
      </body>
    </html>
  </xsl:template>

</xsl:stylesheet>
