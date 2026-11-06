#!/bin/sh
# Hook PreToolUse (Edit|Write|MultiEdit): bloquea cambios a un *.spec.ts que ya está en git.
# Un spec nuevo (sin seguimiento) se puede crear y editar libremente; uno con commit es la
# especificación y solo cambia con aprobación del usuario.
# Entrada: JSON del hook por stdin. Salida: exit 2 + mensaje en stderr para bloquear; exit 0 para permitir.

input=$(cat)

# Lee un campo del JSON con lo que esté instalado (jq → python3 → node → sed como último recurso).
read_field() {
  field="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$input" | jq -r --arg f "$field" '(.tool_input[$f] // .[$f] // empty)'
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$input" | python3 -c 'import json,sys
d=json.load(sys.stdin); f=sys.argv[1]
print((d.get("tool_input") or {}).get(f) or d.get(f) or "")' "$field"
  elif command -v node >/dev/null 2>&1; then
    printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const d=JSON.parse(s),f=process.argv[1];process.stdout.write(String((d.tool_input||{})[f]??d[f]??""))})' "$field"
  else
    printf '%s' "$input" | sed -n "s/.*\"$field\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n 1
  fi
}

file_path=$(read_field file_path)
[ -z "$file_path" ] && exit 0

# Solo aplica a **/*.spec.ts.
case "$file_path" in
  *.spec.ts) ;;
  *) exit 0 ;;
esac

# Sin git no se puede saber si tiene commit: se permite.
command -v git >/dev/null 2>&1 || exit 0

repo_dir="${CLAUDE_PROJECT_DIR:-$(read_field cwd)}"
[ -z "$repo_dir" ] && repo_dir=$(pwd)

# Un spec que git ya conoce está protegido; uno nuevo o sin seguimiento, no.
if git -C "$repo_dir" ls-files --error-unmatch -- "$file_path" >/dev/null 2>&1; then
  echo "Test con commit protegido. Detente y explícame por qué crees que debe cambiar." >&2
  exit 2
fi

exit 0
