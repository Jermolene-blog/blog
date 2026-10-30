#!/bin/bash
# Meadow Games voice recorder
# Records every phrase the games speak, in your own voice, one at a time.
#
# Needs SoX for recording:   brew install sox
# Run:                       bash record-meadow-voice.sh
# Clips are saved to ~/Desktop/meadow-voice (or the folder you pass as the first argument).
# Stop any time with q; run it again later and it carries on from where you left off.
# To redo one clip, delete its .m4a file and run the script again.

set -u
OUT="${1:-$HOME/Desktop/meadow-voice}"
mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if ! command -v rec >/dev/null 2>&1; then
  echo "This script needs SoX to record. Install it with:"
  echo "    brew install sox"
  exit 1
fi

PHRASES='hello|Hello!
name-cow|Cow
name-bull|Bull
name-horse|Horse
name-whitehorse|White horse
name-donkey|Donkey
name-alpaca|Alpaca
name-deer|Deer
name-stag|Stag
name-fox|Fox
name-wolf|Wolf
name-husky|Husky
name-shiba|Shiba inu
peek-intro|Peekaboo! Who'\''s hiding?
peek-cow|Peekaboo! Cow!
peek-bull|Peekaboo! Bull!
peek-horse|Peekaboo! Horse!
peek-whitehorse|Peekaboo! White horse!
peek-donkey|Peekaboo! Donkey!
peek-alpaca|Peekaboo! Alpaca!
peek-deer|Peekaboo! Deer!
peek-stag|Peekaboo! Stag!
peek-fox|Peekaboo! Fox!
peek-wolf|Peekaboo! Wolf!
peek-husky|Peekaboo! Husky!
peek-shiba|Peekaboo! Shiba inu!
fall-intro|Round and round they go. Tap to make them fall down!
fall-down|A-tishoo! A-tishoo! We all fall down!
bed-intro|Time for bed! Tap the animals.
night-cow|Night night, cow!
night-bull|Night night, bull!
night-horse|Night night, horse!
night-whitehorse|Night night, white horse!
night-donkey|Night night, donkey!
night-alpaca|Night night, alpaca!
night-deer|Night night, deer!
night-stag|Night night, stag!
night-fox|Night night, fox!
night-wolf|Night night, wolf!
night-husky|Night night, husky!
night-shiba|Night night, shiba inu!
bed-sleep|Night night, everyone. Sleep tight!
bed-morning|Good morning!
bed-again|Time for bed again!
find-cow|Find the cow!
find-bull|Find the bull!
find-horse|Find the horse!
find-whitehorse|Find the white horse!
find-donkey|Find the donkey!
find-alpaca|Find the alpaca!
find-deer|Find the deer!
find-stag|Find the stag!
find-fox|Find the fox!
find-wolf|Find the wolf!
find-husky|Find the husky!
find-shiba|Find the shiba inu!
yes-cow|Yes! Cow!
yes-bull|Yes! Bull!
yes-horse|Yes! Horse!
yes-whitehorse|Yes! White horse!
yes-donkey|Yes! Donkey!
yes-alpaca|Yes! Alpaca!
yes-deer|Yes! Deer!
yes-stag|Yes! Stag!
yes-fox|Yes! Fox!
yes-wolf|Yes! Wolf!
yes-husky|Yes! Husky!
yes-shiba|Yes! Shiba inu!
thats-cow|That'\''s the cow.
thats-bull|That'\''s the bull.
thats-horse|That'\''s the horse.
thats-whitehorse|That'\''s the white horse.
thats-donkey|That'\''s the donkey.
thats-alpaca|That'\''s the alpaca.
thats-deer|That'\''s the deer.
thats-stag|That'\''s the stag.
thats-fox|That'\''s the fox.
thats-wolf|That'\''s the wolf.
thats-husky|That'\''s the husky.
thats-shiba|That'\''s the shiba inu.
pairs-intro|Find two the same!
two-cow|Two cows!
two-bull|Two bulls!
two-horse|Two horses!
two-whitehorse|Two white horses!
two-donkey|Two donkeys!
two-alpaca|Two alpacas!
two-deer|Two deer!
two-stag|Two stags!
two-fox|Two foxes!
two-wolf|Two wolves!
two-husky|Two huskies!
two-shiba|Two shiba inus!
pairs-win|You found them all!'

printf '%s\n' "$PHRASES" > "$OUT/phrases.txt"
TOTAL=$(printf '%s\n' "$PHRASES" | wc -l | tr -d ' ')

bold=$(tput bold 2>/dev/null); dim=$(tput dim 2>/dev/null); red=$(tput setaf 1 2>/dev/null); off=$(tput sgr0 2>/dev/null)

clear
echo "${bold}Meadow Games voice recorder${off}"
echo
echo "For each phrase: press Enter, say it, press Enter again."
echo "You'll hear it played back, then choose to keep it or try again."
echo "Speak as you would to a toddler: bright, clear and not too fast."
echo
echo "${dim}The first time, macOS asks whether Terminal may use the microphone. Allow it.${off}"
echo "${dim}Saving to: $OUT${off}"
echo
read -r -p "Press Enter to begin. " _ </dev/tty

n=0
while IFS='|' read -r id text <&3; do
  n=$((n+1))
  [ -z "$id" ] && continue
  [ -f "$OUT/$id.m4a" ] && continue
  while true; do
    clear
    echo "${dim}$n of $TOTAL   ($id)${off}"
    echo
    echo
    echo "      ${bold}$text${off}"
    echo
    echo
    read -r -p "Press Enter, then say it.  (s = skip, q = quit) " k </dev/tty
    case "$k" in q|Q) echo; echo "Stopped. Run the script again to carry on."; exit 0;; s|S) break;; esac

    rm -f "$TMP/raw.wav" "$TMP/clean.wav"
    rec -q -c 1 -r 44100 -b 16 "$TMP/raw.wav" 2>/dev/null &
    pid=$!
    sleep 0.15
    read -r -p "${red}● Recording${off}   press Enter when you've finished " _ </dev/tty
    sleep 0.2
    kill -INT "$pid" 2>/dev/null; wait "$pid" 2>/dev/null

    # tidy up: drop the key clicks at each end, trim silence, take out rumble, even out the level
    sox "$TMP/raw.wav" "$TMP/clean.wav" trim 0.1 -0.25 highpass 70 \
        silence 1 0.02 -42d reverse silence 1 0.02 -42d reverse \
        pad 0.05 0.12 norm -1 2>/dev/null
    len=$(soxi -D "$TMP/clean.wav" 2>/dev/null || echo 0)
    if [ "$(echo "$len < 0.25" | bc)" = "1" ]; then
      echo "Didn't catch anything. Check the microphone and try again."
      sleep 1.5
      continue
    fi

    afplay "$TMP/clean.wav"
    read -r -p "Enter = keep it,  r = try again,  p = play again " k </dev/tty
    while [ "$k" = "p" ] || [ "$k" = "P" ]; do
      afplay "$TMP/clean.wav"
      read -r -p "Enter = keep it,  r = try again,  p = play again " k </dev/tty
    done
    if [ "$k" = "r" ] || [ "$k" = "R" ]; then continue; fi
    afconvert -f m4af -d aac -b 64000 -c 1 "$TMP/clean.wav" "$OUT/$id.m4a"
    break
  done
done 3<<< "$PHRASES"

done_count=$(ls "$OUT"/*.m4a 2>/dev/null | wc -l | tr -d ' ')
clear
echo "${bold}$done_count of $TOTAL phrases recorded.${off}"
if [ "$done_count" -lt "$TOTAL" ]; then
  echo "Run the script again to record the ones you skipped."
fi
( cd "$(dirname "$OUT")" && rm -f meadow-voice.zip && zip -qr meadow-voice.zip "$(basename "$OUT")" )
echo
echo "Zipped up as: $(dirname "$OUT")/meadow-voice.zip"
echo "Send that file back in the chat and I'll build the clips into the games."
open -R "$(dirname "$OUT")/meadow-voice.zip" 2>/dev/null
