# TODO: Future Game Commands

## 🍺 Beer/Drink Command

### Concept
A drinking tracker command that works exactly like !bong but for alcoholic beverages. Tracks nightly drinking sessions persistently.

### Basic Structure
- `!beer` / `!drink` / `!shot` - Have a drink with Dazza
- Aliases: `!pint`, `!stubby`, `!tinnie`, `!schooner`
- 5 minute cooldown like bong command
- Tracks drinks per day/night (reset at 6am like a proper session)

### Database Requirements
- `drink_counter` table (date, count, updated_at)
- `user_drinks` table to track individual consumption
- Similar structure to bong tracking

### Features
- Daily drink counter displayed in responses
- Different responses based on drink count:
  - 1-3: "just getting started"
  - 4-8: "proper session now"
  - 9-15: "getting maggot"
  - 16+: "absolutely munted"
- Milestone messages (every 10 drinks)
- Track different drink types if specified

### Integration with Other Systems
- Affects "hydration" for pissing_contest
- Influences mood command
- Could affect gambling odds (drunk decisions)
- Tracked in !top drinkers leaderboard

### Response Examples
- "🍺 That's beer number 5 mate, feelin tipsy"
- "🍺 Stubby number 12, shazza's gonna be pissed"
- "🥃 Shot number 3, this is gonna hurt tomorrow"
- "🍺 *cracks a fresh one* number 8, still vertical somehow"

---

## 🚽 Pissing Contest

### Concept
A PvP challenge game similar to coin_flip where users can challenge each other to a "pissing contest". Results are determined by various factors rather than pure chance.

### Basic Structure
- `!pissing_contest <amount> [username]` - Challenge someone
- Challenged user accepts with a response like "bring it on" or "you're on"
- Both users "compete" with results based on multiple factors
- **Very similar structure to coin_flip command**:
  - Challenge issued with amount and optional target
  - Target must respond with "yes", "no", or variants
  - Accepted variants: "yes", "yeah", "yep", "sure", "ok", "okay", "bring it", "you're on"
  - Declined variants: "no", "nah", "nope", "pass", "fuck off"
  - Same timeout and cleanup mechanics as coin_flip
  - Store challenges in similar database table structure

### Factors That Could Influence Results
- **Hydration level**: Based on recent !bong usage (smoke = dehydration)
- **Beer consumption**: Track mentions of beer/drinks in chat
- **Time since last "break"**: How long user has been active in chat
- **Intimidation factor**: Criminal record, trust level, general stats
- **Wind direction**: Random weather factor
- **Stage fright**: If too many users are watching
- **Age/Seniority**: How long user has been in channel

### Possible Outcomes
- Clean win/loss with distance measurements
- "Both disqualified" - cop showed up
- "Stage fright" - one player couldn't perform
- "Wind interference" - reduced winnings
- "Legendary stream" - rare massive win
- "Bladder explosion" - catastrophic failure

### Crude Humor Opportunities
- Commentary on technique and form
- Comparisons to famous landmarks/distances
- Weather affecting trajectory
- Spectator reactions
- Shazza's disapproval
- Medical emergencies from trying too hard

### Scoring System
- **Three metrics tracked**:
  - Volume (mL)
  - Distance (meters) 
  - Duration (seconds)
- Winner determined by combined score of all three factors
- Each metric contributes to final score calculation

### Leaderboard Integration
- Add to `!top` command: `!top pissing`
- Display columns: Username | Volume | Distance | Duration | Wins
- Track all-time records for each metric
- "Hall of Fame" for legendary performances

### Performance Commentary
- **Lopsided performances trigger special comments**:
  - High volume, short duration: "like a bloody fire hose for 2 seconds"
  - Long duration, low volume: "mate that was just a dribble for 5 minutes"
  - Great distance, low volume: "all pressure no substance"
  - High volume, no distance: "straight down like a waterfall"
- Balanced performances get praised
- Embarrassing nicknames for repeated poor performances

### Technical Considerations
- Need cooldown to prevent spam
- Should track "hydration" state across multiple commands
- Public challenge/accept mechanism like coin_flip
- Results should be publicly announced with crude commentary
- Store performance metrics in database:
  - `pissing_contest_stats` table
  - Track individual match results
  - Maintain rolling averages
- Consider tracking "pissing contest champion" stats

### Future Expansion Ideas
- Tournament mode for multiple participants
- "Training" commands to improve chances
- Special events (full moon = bonus distance)
- Team competitions