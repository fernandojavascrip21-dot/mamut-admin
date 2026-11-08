#!/bin/sh
# Hook PreToolUse (Bash): impide que Claude use o manipule el sistema de desbloqueos de tests.
# Salida: exit 2 + mensaje en stderr para bloquear; exit 0 para permitir.
command=$(jq -r '(.tool_input.command // empty)')
case "$command" in
  *desbloqueos*|*./desbloquear*|*./bloquear*)
    echo "Solo Fernando controla los desbloqueos." >&2
    exit 2 ;;
esac
exit 0
