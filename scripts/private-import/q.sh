#!/bin/zsh
# usage: q.sh file.sql  OR echo sql | q.sh -
source ~/.config/gather-migrate/env
if [[ "$1" == "-" ]]; then SQL=$(cat); else SQL=$(cat "$1"); fi
python3 -I -c 'import json,sys;print(json.dumps({"query":sys.stdin.read()}))' <<< "$SQL" > "${TMPDIR:-/tmp}/q_body_$$.json"
curl -s -X POST "https://api.supabase.com/v1/projects/ozwftlkgqmewtadypsfi/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data @"${TMPDIR:-/tmp}/q_body_$$.json"
rm -f "${TMPDIR:-/tmp}/q_body_$$.json"
