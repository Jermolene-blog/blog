# Brief: British family quiz questions

Audience: British adults, mostly over 40, playing a Buzz!-style quiz at Christmas in the UK.

Write ORIGINAL questions (do not copy from published quiz books or websites).

## Rules
- British English spelling throughout (colour, programme, centre, organise is fine but prefer -ise, metre, aluminium, grey, travelling).
- British culture and frame of reference: UK TV and radio, UK charts, UK sport (football, cricket, rugby, snooker, darts, Wimbledon, Grand National), UK geography, British history, British food, British money (pounds and pence, pre-decimal coinage is fine), metric and imperial as Britons use them (pints, miles, stone). Avoid Americanisms ("soccer", "fall", "zip code", "math", "candy").
- Pitch: mostly people aged 40–75. References from the 1960s to the 2010s are ideal. Avoid anything that depends on events after 2024, and avoid facts likely to change (current office-holders, "most recent winner", records that may have been broken). If a fact is dated, put the date in the question ("In 1966, ...").
- Each question has exactly four options and exactly one correct answer. Distractors must be plausible but unambiguously wrong. No "all of the above", no trick wording, no answers that are matters of opinion or dispute.
- Keep questions short: ideally under 18 words, max 25. Options short: ideally 1–4 words, max 6 words.
- Difficulty: tag each 1 (most of the room would get it), 2 (about half), 3 (one or two would know). Aim for roughly 35% 1, 45% 2, 20% 3.
- Vary the position of the correct answer. Don't make the right answer the longest option.
- Nothing offensive, nothing grim (no murders, disasters, terminal illness), suitable for a family Christmas.
- Only include questions you are highly confident are factually correct. If unsure, leave it out.
- No duplicates within your set.

## Output format
A JSON array written to the file path you are given. Each item:
{"c":"<category id>","d":2,"q":"Question text?","a":["Correct answer","Wrong 1","Wrong 2","Wrong 3"],"k":0}
- "a" is the four options in the order they should be displayed; "k" is the index (0–3) of the correct one. Shuffle so k varies evenly.
- Optional "n": a one-sentence note giving the fact behind the answer, for the fact-checker (not shown to players).

Validate the file with: python3 -c "import json;d=json.load(open('PATH'));print(len(d))"
