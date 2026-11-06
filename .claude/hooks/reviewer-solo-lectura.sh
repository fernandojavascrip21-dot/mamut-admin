#!/bin/sh
# Hook PreToolUse (Bash) del subagente reviewer: solo deja pasar git diff, git status y correr tests.
# Todo lo demás (escribir archivos, git add/commit, instalar, encadenar comandos) se bloquea con exit 2.

input=$(cat)

# Lee tool_input.command con lo que esté instalado (jq → python3 → node).
if command -v jq >/dev/null 2>&1; then
  cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
elif command -v python3 >/dev/null 2>&1; then
  cmd=$(printf '%s' "$input" | python3 -c 'import json,sys; print((json.load(sys.stdin).get("tool_input") or {}).get("command") or "")')
elif command -v node >/dev/null 2>&1; then
  cmd=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>process.stdout.write(String((JSON.parse(s).tool_input||{}).command??"")))')
else
  echo "reviewer: no hay jq, python3 ni node para leer el comando; se bloquea por seguridad." >&2
  exit 2
fi

deny() {
  echo "reviewer es de solo lectura: solo puede usar git diff, git status y correr tests. Bloqueado: $cmd" >&2
  exit 2
}

[ -z "$cmd" ] && deny

# Un solo comando por línea: nada de saltos de línea.
case "$cmd" in
  *"
"*) deny ;;
esac

# Se permite un único prefijo «cd <carpeta> && » (para correr los tests del backend).
rest="$cmd"
case "$rest" in
  "cd "*" && "*)
    dir=${rest#cd }
    dir=${dir%% && *}
    rest=${rest#cd "$dir" && }
    case "$dir" in
      *[!A-Za-z0-9._/-]*) deny ;;
    esac
    ;;
esac

# Sin encadenar, redirigir ni sustituir comandos.
case "$rest" in
  *";"*|*"&"*|*"|"*|*">"*|*"<"*|*'`'*|*'$('*) deny ;;
esac

# git diff no puede escribir a un archivo ni usar un diff externo.
case "$rest" in
  *"--output"*|*"--ext-diff"*) deny ;;
esac

case "$rest" in
  "git diff"|"git diff "*|"git status"|"git status "*) exit 0 ;;
  "npm test"|"npm test "*|"npm run test"|"npm run test "*) exit 0 ;;
  "npx ng test"|"npx ng test "*|"ng test"|"ng test "*) exit 0 ;;
  "npx vitest run"|"npx vitest run "*|"npx vitest"|"npx vitest "*) exit 0 ;;
esac

deny
