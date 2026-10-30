# Brief: second, evidence-based fact-check

A first checker reviewed these questions from memory and passed almost all of them. That is not good enough: the quiz will be played by people who will argue about every wrong answer. Your job is to verify with evidence.

Read /home/claude/buzz/QUESTION_BRIEF.md for the writing rules.

For your file:
1. Go through every question. Classify it as SAFE (a fact any encyclopaedia would state unambiguously and that cannot have more than one defensible answer, e.g. "capital of Scotland") or RISKY (dates, years, numbers, chart positions, "first/largest/longest/oldest/most", who-said/who-played/who-wrote, record holders, origins/etymologies, anything with a qualifier).
2. For every RISKY question, run at least one WebSearch (and WebFetch the page if the snippet isn't conclusive) and confirm the marked answer is right AND each distractor is wrong. Expect to run 20–40 searches. Don't skip this.
3. Check the wording for ambiguity: could a pedant defend another option? Is there a well-known "actually..." (e.g. the folk etymology, the disputed first)? If so, reword to make it airtight or drop it.
4. Fix or drop. Prefer fixing. Drop anything you cannot verify.

Write the cleaned array (same JSON item format, no "n" field) to /home/claude/buzz/checked2/<same filename>, and a log to /home/claude/buzz/checked2/<name>.log.md listing every fix and drop with the evidence (URL) in one line each.
Validate the JSON parses and every item has c, d (1–3), q, a (4 distinct strings), k (0–3).
Reply only with: searches run, kept, fixed, dropped.
