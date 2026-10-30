# Brief: Quizbuzz questions (replaces QUESTION_BRIEF.md)

Quizbuzz is a family quiz show played at Christmas in the UK: a TV studio on the big screen, a buzzer on everyone's phone. It should feel like a game show, not a school test. Every question should make the room laugh, groan, argue, or say "no way!".

Audience: British adults, mostly aged 30 to 60, who know telly, music, food, sport and everyday life far better than textbooks.

Write ORIGINAL questions (do not copy from quiz books or websites).

## The fun test

Before keeping a question, ask: **what's the hook?** One of these must be true:
- The answer is surprising, funny or a bit ridiculous (wombat poo is cube-shaped).
- It starts an argument (what do you call a bread roll?).
- It's about something everyone has handled, eaten, watched or sung along to.
- It's a little game in itself: an anagram, a film in emoji, finish the lyric, which is real.
- It's a "which came first?" or "would you believe it?" that upends what people assume.

If the only reaction is "I either know that fact or I don't", drop it.

## Eras

- Centre of gravity: **1990 to 2025**. The 1980s are fine.
- Before 1980 only if everyone under 60 still knows it today (the Beatles, Queen, Morecambe & Wise at Christmas, The Snowman). No 1950s or 60s radio or TV, no music-hall, no pre-decimal money.
- Recent things (2023 to 2025) are welcome but must be firmly settled facts, with the year in the question if the fact could change.

## Banned shapes

- "In which year was…", "On what date…" (history by dates)
- Battles, treaties, strikes, Acts of Parliament, lists of monarchs or prime ministers
- Capitals and rivers of places nobody visits; "which county is X in"
- Authors' real names, poets laureate, who wrote which novel (unless it's a smash hit everyone has seen on screen)
- Textbook science (laws of motion, chemical symbols, parts of the cell)
- Questions where the right answer is obviously the "posh" or "clever" option

History and science are allowed only as surprises ("Cleopatra lived nearer to the Moon landing than to the building of which?"; "Scotland's national animal is what?").

## Shapes to use

- **Would you believe it?** surprising facts, "which of these is real?", "which came first?".
- **Everyday life:** supermarkets, crisps and chocolate, adverts, sayings, regional words, gadgets, the Highway Code, the kitchen drawer, the Christmas tin.
- **Pop culture, 1990–2025:** Bake Off, Strictly, The Traitors, Gavin & Stacey, Taskmaster, Line of Duty, Love Island, streaming hits, Christmas number ones, viral moments, catchphrases, adverts.
- **Word games:** anagrams (check every letter), films or phrases in emoji, finish the lyric, real word or made up, what does this slang mean.
- **Closest wins:** see below.

## Rules (unchanged from the old brief)

- British English and British frame of reference. No Americanisms.
- Exactly four options, exactly one correct. Wrong answers must be clearly wrong, but one cheeky or silly wrong answer per question is encouraged.
- Short: question ideally under 18 words (max 25); options 1 to 4 words (max 6).
- Difficulty 1 (most of the room), 2 (about half), 3 (one or two). Aim for 40% 1, 45% 2, 15% 3. Fun matters more than hard.
- Vary the position of the right answer; don't make it the longest option.
- Nothing offensive or grim (no murders, disasters, illness). Fine for a family Christmas.
- Only questions you are highly confident are correct. If unsure, leave it out.

## Categories

| id | Name on screen | What goes in it |
|---|---|---|
| tv | Telly | TV and streaming, 1990 on |
| music | Pop Music | charts, lyrics, Christmas number ones, Eurovision |
| film | At the Movies | films, emoji films, quotes |
| food | Food & Drink | brands, sweets, crisps, pub, takeaways, renamed products |
| sport | Sport | big moments, odd rules, famous celebrations |
| xmas | Christmas | carols, films, adverts, the tin, traditions |
| life | Everyday Life | shops, gadgets, Highway Code, money, the home |
| wow | Would You Believe It? | surprising facts, which came first, which is real |
| words | Word Games | anagrams, emoji phrases, slang, real or made up |
| uk | Around Britain | places, regional words, landmarks, oddities |

## Output format (four-option questions)

A JSON array. Each item:
{"c":"<category id>","d":2,"q":"Question text?","a":["Option","Option","Option","Option"],"k":0,"hook":"why it's fun, a few words","n":"the fact behind the answer, for the checker"}

## Closest wins

Questions whose answer is a number that nobody could know but everyone can guess: how many cups of tea Britons drink a day, how tall the Shard is. Players type a number; the nearest wins.

- The number must come from a reputable, citable source (an official body, the company itself, a major newspaper). Give it in "src".
- Prefer round, memorable, still-true figures. Put the year in the question if it varies ("In 2024, how many…").
- The fun is in the gasp at the reveal: pick things where guesses will range wildly.
- Say the unit in the question and in "u" (keep "u" short: "cups", "metres", "miles", "people").

Format:
{"c":"guess","d":2,"q":"How many cups of tea do Britons drink every day?","n":100000000,"u":"cups","src":"UK Tea and Infusions Association","hook":"…"}
