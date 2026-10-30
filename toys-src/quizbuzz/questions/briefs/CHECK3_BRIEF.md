# Brief: evidence-based fact-check (batch 2)

Read /home/claude/buzz/QUESTION_BRIEF.md for the writing rules. Someone else wrote the questions in your file; assume nothing is right until checked.

1. Classify each question SAFE (an unambiguous encyclopaedia fact with one defensible answer) or RISKY (dates, numbers, chart positions, firsts/largest/oldest/most, who-played/wrote/said, records, origins, anything with a qualifier).
2. Verify every RISKY question against a source. Budget: at most 40 WebSearch calls in total — a shared limit across several checkers, so stay under it. Prefer WebFetch of one Wikipedia page that settles several questions (e.g. a list page) over many searches. Confirm the marked answer is right AND each wrong option is wrong.
3. Check for ambiguity a pedant could exploit; reword to make it airtight or drop it.
4. Also check the question doesn't duplicate one in /home/claude/buzz/existing/<cat>.txt (drop near-duplicates).
5. Drop anything you could not verify. Prefer fixing over dropping.

Write the cleaned array (same JSON item format, without the "n" field) to /home/claude/buzz/checked4/<cat>.json and a log to /home/claude/buzz/checked4/<cat>.log.md listing every fix and drop with a one-line reason and source URL.
Validate the JSON parses and every item has c, d (1–3), q, a (4 distinct strings), k (0–3).
Reply only with: searches run, kept, fixed, dropped.
