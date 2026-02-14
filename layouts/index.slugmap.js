{{- /* Hugo-generated JS slug map (respects hidden flag) */ -}}
window.__GAMES_BY_SLUG__ = {
{{- $games := site.Data.games -}}
{{- $first := true -}}
{{- range $g := $games -}}
  {{- $hidden := or (eq (index $g "hidden") true) (eq (index $g "hidden") 1) -}}
  {{- if not $hidden -}}
    {{- $title := (index $g "title") | default "" | string -}}
    {{- $url := (index $g "link") | default "" | string -}}
    {{- $slug := (index $g "slug") | default "" | string -}}
    {{- if eq $slug "" -}}
      {{- $slug = ($title | urlize) -}}
    {{- end -}}
    {{- if and (ne $slug "") (ne $title "") (ne $url "") -}}
      {{- if not $first }},{{ end -}}
      {{ $slug | jsonify }}: {"title": {{ $title | jsonify }}, "url": {{ $url | jsonify }}}
      {{- $first = false -}}
    {{- end -}}
  {{- end -}}
{{- end -}}
};
