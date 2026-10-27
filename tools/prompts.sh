#!/bin/zsh
# 山頂國小美術：GPT 生圖（一張一張跑，tools/gen.sh 靠「最新的檔」抓圖，不能並行）
# 用法：zsh tools/prompts.sh [名稱...]（不給就全跑）；原圖存 work/gen/，轉檔後放 art/
cd "$(dirname $0)/.."
G=tools/gen.sh
STYLE="hand-painted gouache illustration for a cozy mobile game, muted warm colors, soft paper grain, gentle flat lighting, no people, no characters, no text, no letters, no logos"
typeset -A P
P[bg-class]="Vertical 2:3 background. Inside a small old Taiwanese elementary school classroom on a mountaintop, seen straight on from the front: a wide dark green chalkboard with a light wooden frame covers the middle of the back wall, it is wiped clean with only faint chalk smudges; wooden chalk tray with a few chalk sticks; cream plaster wall above with a round wall clock; tall windows at the far left and right edges showing green mountains and white clouds; worn wooden floor along the bottom. The center area is calm and uncluttered. $STYLE"
P[bg-yard]="Vertical 2:3 background. The sports field of a tiny elementary school on top of a green mountain in Taiwan, seen from the side at eye level: a red running track and green field in the lower third, a low two-storey white school building with a red roof and a small flag pole in the middle distance, a big banyan tree at one side, layers of blue-green mountain ridges and a sea of white clouds behind, bright afternoon sky. The center area is calm and uncluttered. $STYLE"
P[bg-dusk]="Vertical 2:3 background. The open-air corridor and rooftop of a small mountaintop elementary school at sunset in Taiwan, seen from the side: a terrazzo floor with a low green railing along the bottom, potted plants, beyond the railing far mountain ridges glowing orange and purple, a sea of clouds lit by the setting sun, first stars in a deep blue upper sky. The center area is calm and uncluttered. $STYLE"
P[logo]="Chalk lettering on a pure flat black background: the four Traditional Chinese characters 救救小編 written large and bold in thick white chalk, playful hand-lettered schoolteacher style, slightly uneven strokes with chalk dust texture and rough edges, one line, centered, nothing else in the image except a few tiny chalk sparkles, wide 3:2 image"
P[board]="A small empty rectangular classroom chalkboard seen perfectly straight on, flat front view, filling the whole image edge to edge: dark green slate surface with faint chalk smudges, and a light natural wood frame about 6 percent of the width on all four sides with visible grain and slightly worn corners, square image, no text, no shadow, no background visible"
P[paper]="A sheet of Taiwanese elementary school notebook paper seen perfectly straight on, filling the whole image edge to edge: warm off-white paper with light blue horizontal ruled lines and one thin red vertical margin line on the left, faint pencil smudges, slightly wavy paper texture, square image, no text, no shadow, no background visible"
if (( $# )); then names=($@); else names=(bg-class bg-yard bg-dusk logo board paper); fi
for n in $names; do
  [ -f work/gen/$n.png ] && { echo "skip $n"; continue; }
  $G work/gen/$n.png "${P[$n]}"
done

# 分享縮圖（連結預覽）：zsh tools/prompts.sh thumb-h thumb-v（參考圖 work/thumb/ref.png＝小編＋兔兔老師三視圖正面）
