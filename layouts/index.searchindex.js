{{- /* Hugo-generated JS search index (respects hidden flag) */ -}}
window.__GAME_INDEX__ = [
{{- $games := site.Data.games -}}
{{- $first := true -}}
{{- range $g := $games -}}
  {{- $hidden := or (eq (index $g "hidden") true) (eq (index $g "hidden") 1) -}}
  {{- if not $hidden -}}
    {{- $title := (index $g "title") | default "" | string -}}
    {{- $url := (index $g "link") | default "" | string -}}
    {{- if and (ne $title "") (ne $url "") -}}
      {{- if not $first }},{{ end -}}
      {"title": {{ $title | jsonify }}, "url": {{ $url | jsonify }}}
      {{- $first = false -}}
    {{- end -}}
  {{- end -}}
{{- end -}}
];
