# Brief: source check for batch 2 (strict)

You are an independent fact-checker. Read questions/briefs/QUESTION_BRIEF.md (in /home/claude/hands-on-buzzers) for the writing rules.
Your input file is /home/claude/hands-on-buzzers/questions/batch2-unverified/<cat>.json. A previous reviewer passed most items from memory; that is not acceptable for players who will argue about every answer.

1. Classify each question SAFE (an unambiguous encyclopaedia fact with exactly one defensible answer, e.g. a capital city) or RISKY (dates, numbers, chart positions, firsts/largest/oldest/most, who played/wrote/said/presented, records, origins and etymologies, anything with a qualifier).
2. Every RISKY question must be confirmed by a source you actually opened or a search result that states it. Use WebSearch (budget: at most 45 searches) and WebFetch only on URLs returned by your searches (direct Wikipedia URLs you type yourself are refused). One search can settle several questions: search for a list page and fetch it.
3. Confirm the marked answer AND that each wrong option is wrong. Close any loophole a pedant could use (reword, swap a distractor) or drop it.
4. Drop every RISKY question you could not confirm. Do not keep anything on memory alone.

Write the kept items (same format, no "n" field) to /home/claude/hands-on-buzzers/questions/checked-batch2/<cat>.json and a log to /home/claude/hands-on-buzzers/questions/checked-batch2/<cat>.log.md: one line per RISKY item with its source URL, plus fixes and drops with reasons.
Validate: JSON parses; every item has c, d (1–3), q, a (4 distinct strings), k (0–3).
Reply only with: searches run, kept, fixed, dropped.
