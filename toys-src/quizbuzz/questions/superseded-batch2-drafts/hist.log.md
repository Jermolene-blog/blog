# hist fact-check log (batch 2)

Input: /home/claude/buzz/q2/hist.json (70). Output: 63 kept (4 fixed), 7 dropped. Searches run: 5 (Wikipedia direct fetches blocked by allowlist; checks used search results and fetched secondary pages).

## Drops
- "Which monarch reigned from 1837 to 1901?" — near-duplicate: existing/hist.txt "Which king reigned from 1830 to 1837, before Victoria?" reveals Victoria and 1837.
- "Which Scottish-born inventor patented the telephone in 1876?" — duplicates existing/sci.txt "Who patented the telephone in 1876?"
- "Who discovered penicillin in 1928?" — identical to existing/sci.txt.
- "Who first publicly demonstrated television in 1926?" — duplicates existing/sci.txt 1926 Baird question; also factually shaky (first public demo was Selfridges 1925). https://www.history.co.uk/articles/first-tv-demonstration-john-logie-baird
- "Which Briton invented the World Wide Web in 1989?" — duplicates existing/sci.txt "Which British scientist invented the World Wide Web?"
- "Who commissioned the first commercial Christmas card in 1843?" — identical to existing/xmas.txt.
- "Who wrote 'The Canterbury Tales'?" — gives away existing/words.txt "Chaucer's pilgrims were travelling to which city?"

## Fixes
- NHS/Bevan: removed "in 1948" — it gave away existing/hist.txt "In which year was the NHS launched?" Now "Which Health Minister founded the NHS?"
- Community Charge: "The 1990 Community Charge" -> "Thatcher's Community Charge" (it started in Scotland in 1989, so "1990" is pedant-bait).
- Guinea: "How much was a guinea worth?" -> "In pre-decimal money, how much was a guinea worth?" (value floated before being fixed at 21s in 1717).
- Bletchley: removed Alan Turing from the question; it gave away existing/sci.txt "Which Bletchley Park codebreaker appeared on the new £50 note?" Now "At which country house were Enigma codes broken in the Second World War?"

## Verified (risky items, sources)
- Treetops, night of 5-6 Feb 1952; told of the death after leaving (so Sagana Lodge is the wrong answer for "staying the night"): https://www.citizen.digital/news/fell-asleep-a-princess-awoke-a-queen-elizabeth-in-kenya-n305324
- George II at Dettingen 1743, last British monarch to lead troops in battle: https://www.forcesnews.com/services/tri-service/george-ii-last-british-monarch-lead-his-troops-battle ; https://www.nam.ac.uk/whats-on/battle-dettingen-1743
- Westminster Abbey consecrated 28 December 1065 under Edward the Confessor: https://westminster-abbey.org/abbey-commemorations/royals/edward-the-confessor-and-edith
- Everything else (Tudor wives, PMs, Culloden, Garter, Agincourt, Caxton, Sutton Hoo, Endurance, Hunt, Alcock and Brown, Naseby, Wind of Change, Arne, coinage, royal dates, and so on) is standard reference fact, checked against what I already know without a search, to stay within the shared search budget. No errors found in the marked answers or distractors.
