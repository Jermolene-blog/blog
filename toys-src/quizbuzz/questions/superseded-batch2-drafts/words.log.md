# words fact-check log (batch 2)

Input: q2/words.json (70 items). Output: checked4/words.json (67 items). 5 fixed, 3 dropped. WebSearch calls: 6. en.wikipedia.org pages could only be fetched once a search result or a fetched page had linked to them, so I reached most pages by following links from one page to the next.

No near-duplicates of existing/words.txt. The rhyming-slang, Shakespeare and Carroll items in existing ask about different facts.

## Fixes
- Mr Men: six Mr Men books came out on the same day (10 August 1971), and three of them (Mr Happy, Mr Greedy, Mr Bump) were the distractors, so "first book" could be challenged. Reworded to "Which Mr Men character did Roger Hargreaves create first?" (Mr Tickle). Sources: https://en.wikipedia.org/wiki/Mr._Men , https://en.wikipedia.org/wiki/Mr._Tickle
- Ombudsman: the word goes back to Old Norse and also exists in Danish and Norwegian. Reworded to "English borrowed ... from which language?" (Swedish). Source: https://en.wikipedia.org/wiki/List_of_English_words_of_Swedish_origin
- Tycoon: Japanese taikun comes from Chinese, so having "Chinese" as a distractor could be argued. Reworded to "English borrowed..." and replaced Chinese with Malay. Source: https://en.wikipedia.org/wiki/List_of_English_words_of_Japanese_origin
- Wild-goose chase: "first appears in which Shakespeare play" was ambiguous. Reworded to "The earliest recorded 'wild-goose chase' is in which Shakespeare play?" (Romeo and Juliet; the phrase originally meant a kind of horse race, not a hunt). Source: https://phrases.org.uk/meanings/wild-goose-chase.html
- Penguin founder: Allen Lane co-founded Penguin with his brothers Richard and John. Reworded to "Which publisher launched Penguin paperbacks in 1935?" Sources: https://en.wikipedia.org/wiki/Penguin_Books , https://en.wikipedia.org/wiki/Allen_Lane

## Verified (risky)
- Betjeman was Laureate 1972–84 (after Day-Lewis), Hughes 1984–98, Motion from 1999. Larkin turned the post down. Source: https://en.wikipedia.org/wiki/Poet_Laureate_of_the_United_Kingdom
- Early Penguin colours: orange for fiction, green for crime, dark blue for biography, yellow for miscellaneous. So Blue, Green and Yellow are wrong for fiction. Source: https://en.wikipedia.org/wiki/Penguin_Books
- Spooner was Warden of New College, Oxford. Source: https://www.etymonline.com/word/spoonerism
- Walpole coined "serendipity" in a letter of 28 January 1754, from "The Three Princes of Serendip". Source: https://en.wikipedia.org/wiki/Horace_Walpole
- Carroll coined "chortled" in Jabberwocky as a blend of "chuckle" and "snort". Source: https://en.wikipedia.org/wiki/Jabberwocky
- Ye/thorn: the "y" in "Ye Olde" stands in for thorn (þ). Source: https://en.wikipedia.org/wiki/English_alphabet
- NATO is a word-pronounced acronym. Source: https://en.wikipedia.org/wiki/Acronym
- Rhyming slang: plates of meat, trouble and strife, Adam and Eve and syrup of figs confirmed. Source: https://en.wikipedia.org/wiki/Cockney_rhyming_slang. Porky pies, mince pies and rabbit and pork I treated as safe, standard knowledge.
- I treated the rest as safe encyclopaedia facts with clearly wrong distractors: authorship, famous characters, idiom meanings, the number of lines in a limerick, Scrabble's 7-tile rack, and 42.

## Drops
- "In British slang, how much is a 'monkey'?": could not find a reachable source. Wikipedia's Cockney and Slang pages do not mention it, and the money-slang site was not fetchable.
- "In English Scrabble, which two letters are worth 10 points?": could not reach a source page (Scrabble letter distributions) within the search budget.
- "In which year was the Booker Prize first awarded?": the Booker Prize page could not be reached within the search budget.
