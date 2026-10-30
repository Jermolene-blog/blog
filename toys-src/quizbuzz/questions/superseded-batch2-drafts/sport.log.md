# sport fact-check log (batch 2)

Input: q2/sport.json (70 items). Output: checked4/sport.json (70 items). 3 fixes, 0 drops. Searches run: 6 (direct Wikipedia fetches were refused by the allowlist unless the URL had appeared in a search result, so pages were reached via search results). No near-duplicates of existing/sport.txt (overlapping topics such as 1966, Wimbledon, the FA Cup and snooker nicknames ask about different facts).

## Fixes
- Isle of Man TT: distractor "The Grand Prix" is arguably correct, since the Manx Grand Prix is a real Isle of Man motorcycle road race. "The Superbike" is a TT race class and "The Manx Rally" is a real (car) event. All three replaced with invented names (The Moto Cup, The Snaefell Dash, The Peel Sprint). Knowledge-based; no source fetched.
- First Cricket World Cup: the first women's Cricket World Cup was held in England in 1973, so "the first Cricket World Cup held in England" could be challenged. Reworded to "In which year did England host the first men's Cricket World Cup?" Knowledge-based.
- Clive Lloyd: the question text ("1975 and 1979") gave away the answer to the first-World-Cup question. Reworded to "to the first two men's Cricket World Cup titles". Knowledge-based.

## Verified against sources
- Chataway won the first SPOTY in 1954, beating Bannister: https://en.wikipedia.org/wiki/BBC_Sports_Personality_of_the_Year_Award
- Steve Davis made the first televised maximum, at the 1982 Classic in Oldham. Spencer's 1979 break was not recorded and Joe Davis's 1955 break was not televised: https://en.wikipedia.org/wiki/Maximum_break , https://en.wikipedia.org/wiki/Steve_Davis
- Piggott won the Derby nine times, Never Say Die (1954) to Teenoso (1983): https://en.wikipedia.org/wiki/Lester_Piggott
- A golden duck is out to the first ball faced. A diamond duck is out without facing a ball, a silver duck is out to the second ball, and a pair is nought in both innings. All three distractors are wrong: https://en.wikipedia.org/wiki/Duck_(cricket)
- Ashe beat Connors in the 1975 final: https://en.wikipedia.org/wiki/List_of_Wimbledon_gentlemen%27s_singles_champions
- Ann Jones won in 1969 (beating King). Graf won in 1988, 89, 91, 92, 93, 95 and 96. Mortimer won in 1961, not 1969. Truman never won: https://en.wikipedia.org/wiki/List_of_Wimbledon_ladies%27_singles_champions
- Sheene won the 500cc title in 1976 and 1977: https://en.wikipedia.org/wiki/Barry_Sheene

## Kept on knowledge (not source-checked; search budget exhausted)
These are standard, widely documented facts and I am highly confident in each, with clearly wrong distractors: Hendry's seven 1990s world titles; Arkle's Gold Cups (1964–66); McCoy/Don't Push It (2010); Reardon "Dracula"; Hereford v Newcastle (1972); Lloyd's 1975/79 captaincy; India 1983; Radcliffe London 2003; Graham Hill 1962/68; Lawrie 1999; Woosnam 1991; Jacklin's 1969 Open; Matthews Final; Manchester 2002; St Leger 1776; Wanderers 1872; Lara 501* for Warwickshire; Barry John "The King"; Prestwick 1860; Portugal in the 1966 semi-final; McEnroe at Wimbledon in 1981; Cooper v Clay in 1963; Wiggins 2012; Paisley's three European Cups; Dalglish to Liverpool in 1977; ten hurdles in the 110m. All the rest are SAFE definitional or rules facts.

## Drops
- None.
