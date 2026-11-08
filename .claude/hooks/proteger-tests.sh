#!/bin/sh
# Hook PreToolUse (Edit|Write|MultiEdit): protege los tests con commit.
# - Nadie salvo Fernando toca .claude/desbloqueos/, ./desbloquear ni ./bloquear.
# - Un spec nuevo (sin seguimiento) es libre.
# - Un spec con commit solo se edita si Fernando lo desbloqueó para la rama actual (./desbloquear).
# Entrada: JSON del hook por stdin. Salida: exit 2 + mensaje en stderr para bloquear; exit 0 para permitir.

DESBLOQUEOS_DIR=".claude/desbloqueos"

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '(.tool_input.file_path // empty)')
[ -z "$file_path" ] && exit 0

repo_dir="${CLAUDE_PROJECT_DIR:-$(printf '%s' "$input" | jq -r '(.cwd // empty)')}"
[ -z "$repo_dir" ] && repo_dir=$(pwd)
root=$(git -C "$repo_dir" rev-parse --show-toplevel 2>/dev/null) || exit 0

# Ruta relativa a la raíz del repo.
rel="${file_path#"$root"/}"

# Los controles del desbloqueo son solo de Fernando.
case "$rel" in
  .claude/desbloqueos|.claude/desbloqueos/*|desbloquear|bloquear|./desbloquear|./bloquear)
    echo "Solo Fernando controla los desbloqueos." >&2
    exit 2 ;;
esac

# Solo aplica a specs/tests.
case "$rel" in
  *.spec.ts|*.test.ts) ;;
  *) exit 0 ;;
esac

# Un spec sin seguimiento (nuevo) es libre.
git -C "$root" ls-files --error-unmatch -- "$rel" >/dev/null 2>&1 || exit 0

# Con commit: pasa solo si está listado en el archivo de desbloqueos de la rama actual.
branch=$(git -C "$root" rev-parse --abbrev-ref HEAD 2>/dev/null)
case "$DESBLOQUEOS_DIR" in
  /*) dir="$DESBLOQUEOS_DIR" ;;
  *) dir="$root/$DESBLOQUEOS_DIR" ;;
esac
list="$dir/$(printf '%s' "$branch" | sed 's#/#__#g').txt"
if [ -f "$list" ] && grep -Fxq -- "$rel" "$list"; then
  exit 0
fi

echo "Test con commit protegido. Detente y explícame por qué crees que debe cambiar. Si es un cambio de comportamiento, Fernando lo desbloquea con ./desbloquear <componente>." >&2
exit 2
