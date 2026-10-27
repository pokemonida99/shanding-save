#!/bin/zsh
# gen.sh <out.png> <prompt> [ref]
# 用 --json 拿到這次的 thread id，只拿 ~/.codex/generated_images/<thread id>/ 裡的圖（別的 session 同時在生圖也不會拿錯）
# stdin 接 /dev/null：在背景跑時 codex 才不會卡在「Reading additional input from stdin」
out=$1; prompt=$2; ref=$3
CODEX=/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex
args=(exec --skip-git-repo-check --json "Generate one image with your image generation tool: $prompt. Do not run any shell commands.")
[ -n "$ref" ] && args+=(-i "$ref")
$CODEX $args < /dev/null > "$out.log" 2>&1
tid=$(grep -o '"thread_id":"[^"]*"' "$out.log" | head -1 | cut -d'"' -f4)
img=$(ls -t ~/.codex/generated_images/$tid/*.png 2>/dev/null | head -1)
if [ -n "$tid" ] && [ -n "$img" ]; then cp "$img" "$out"; echo "ok $out ($tid)"; else echo "FAIL $out (thread ${tid:-?})"; fi
