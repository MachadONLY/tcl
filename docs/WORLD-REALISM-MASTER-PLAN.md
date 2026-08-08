# Touchline Living World — Master Realism Plan

Status: execution blueprint
Branch: `feat/playable-career-v1`
Goal: build a deterministic-but-emergent football world that remains plausible, varied and internally coherent across long careers.

## 0. Product law

The world must never rely on scripted transfers, scripted manager moves, scripted injuries or scripted career stories.

The simulation is causal:

`real-world starting data + stable identities + current save state + football rules + contextual uncertainty = outcome`

Two saves may diverge. The same save must be reproducible. The same club/player identity must remain recognisable across saves.

### Seed separation

- `identitySeed`: player/club/manager ID + database version. Stable across saves. Used for underlying personality and institutional identity.
- `saveSeed`: save ID + createdAt. Different per career. Used only for uncertainty, timing and plausible branching.
- `eventSeed`: saveSeed + date + entities + event type. Makes daily decisions deterministic inside a save.

Randomness is only a tie-breaker after impossible or implausible options have been removed.

## 1. Reference model: what to learn from FM and EA FC

We do not copy proprietary source code. We reproduce publicly documented design ideas with independent code.

### Football Manager principles to adopt

- Recruitment begins with squad imbalance and tactical/attribute gaps.
- Current Ability and Potential Ability have different weights depending on intended squad role.
- Club Vision influences recruitment profile, especially youth policy.
- Selling and loans are contextual, not generic list operations.
- Rumoured Interest and Active Interest are distinct states.
- Player/agent reactions depend on personality, relationship and context.
- Loan destinations should improve the player in relevant ways and include promised role/position.
- FFP/finance affects AI recruitment.
- Managers rotate squads according to match priority and development goals.
- Development is not a single linear curve; early developers and late developers exist.
- Transfer requirements can describe position, tactical role, expected playing time and deal type.

Official references:
- Football Manager: Smarter Transfers, Squad Building and Finance
- Football Manager 26: Powered by TransferRoom — Recruitment Revamp
- Football Manager: Introducing Intermediaries and Offloading Players
- Football Manager: Individual Player Targets and Interaction Logic
- Football Manager 26: Your Style, Your Personality

### EA SPORTS FC principles to adopt

- Managers can be sacked, poached or leave voluntarily.
- A new manager changes Tactical Vision; that tactical change must trigger a new squad evaluation, shortlist and surplus analysis.
- Match importance and current form influence AI lineups.
- Contract renewal must be contextual; players are not permanently willing to negotiate.
- AI becomes more alert to players approaching the end of contracts.
- Selected leagues can be simulated more deeply, with stats feeding scouting and world narratives.
- Unexpected events should interrupt simulation only when a meaningful decision is required.

Official reference:
- EA SPORTS FC 26 Career Mode Deep Dive

## 2. Architecture rules

### 2.1 Single source of truth

`career.world` is authoritative for dynamic world state.

Static database:
- clubs
- players
- managers
- competitions
- starting contracts
- starting ratings/attributes

Dynamic save state:
- employment
- contracts
- loans
- injuries/suspensions
- form/fatigue
- happiness/promises
- club finance
- manager employment
- transfer activity
- competition state
- development
- retirements/newgens

UI never invents world state. News, Inbox and Market read from the event ledger and selectors.

### 2.2 Cause must be inspectable

Every significant AI decision stores reason codes, for example:

- `SQUAD_SHORTAGE`
- `QUALITY_GAP`
- `TACTICAL_ROLE_GAP`
- `AGE_PROFILE`
- `CONTRACT_EXPIRY`
- `PLAYER_UNHAPPY`
- `PLAYER_WANTS_CHAMPIONS_LEAGUE`
- `SURPLUS_TO_REQUIREMENTS`
- `YOUTH_PATHWAY_BLOCKED`
- `FINANCE_SALE_REQUIRED`
- `INJURY_REPLACEMENT`
- `MANAGER_TACTICAL_CHANGE`
- `LOAN_DEVELOPMENT`

The Realism Lab can therefore explain why an absurd outcome happened instead of only reporting it.

### 2.3 State machines over one-shot rolls

Transfers, contracts, loans, promises, injuries and manager hiring must progress through explicit states over time. No teleporting from need to completed deal.

### 2.4 Sparse state

Large world databases remain mostly static. Dynamic objects are created only when a player/club becomes active in a system. Maintain indexes for employment, contracts, active negotiations, loans and competitions.

## 3. Phase 0 — World Realism Lab [FIRST GATE]

Before adding more simulation depth, install a headless simulator that can run many careers and audit them.

### V1 now

Run 25–100 distinct save seeds through one transfer window / one current season and measure:

- reproducibility of same seed
- diversity between seeds
- completed transfers
- rumor-to-approach conversion
- abandoned rumors
- fee distribution
- age distribution
- transfer spend/income/net spend
- squad size by club
- position-group balance
- free agents
- duplicate/impossible employment
- simultaneous competing approaches
- user inbox spam protection
- runtime cost

### V2 after season rollover

Run `100 saves × 5 seasons` and add:

- manager churn
- league champions/top-four/relegation distributions
- player minutes
- development/decline
- loans and recall
- expiring contracts/Bosman
- retirements/newgens
- club solvency
- squad-registration health

### Hard invariants

These always fail CI:

- same player employed by two clubs
- completed transfer with missing buyer/player
- club completes fee above available permitted funds
- one player completes two transfers on same date
- active loan and permanent employment states conflict
- contract belongs to wrong employer after a move
- retired player appears in match squad
- suspended/injured unavailable player selected when rules forbid it
- deterministic replay differs for same seed/input

### Soft realism alerts

These are calibrated statistically and become gates once baseline distributions are known:

- extreme fee for veteran
- squad < safe minimum or > safe maximum
- positional hoarding
- too many free agents of high quality
- excessive transfer volume
- excessive manager churn
- unrealistic injury burden
- young-player development too fast/slow
- club spending structurally above sustainable finances

### Calibration rule

Do not guess permanent thresholds. Store versioned realism baselines derived from real-world reference distributions and adjust by league/club level.

## 4. Phase 1 — Contracts + Agents

### Contract state machine

`secure -> review-window -> open-to-renew -> negotiating -> renewed`

Alternative paths:

`review-window -> unwilling-to-renew -> sale-pressure -> expiring -> precontract-eligible -> free-agent`

### Contract model

- start/end date
- wage
- squad role
- signing fee
- appearance/goal/clean-sheet bonuses
- release clause where rules/market support it
- optional club/player extension
- agent fee
- promised playing time
- future role/pathway

### Player willingness

Driven by PlayerBrain + context:

- ambition
- loyalty
- happiness
- playing time
- manager relationship
- club trajectory/reputation
- continental competition
- wage standing within squad
- age/career stage
- interest from other clubs

Players are not available for renewal every day. Renewal windows emerge from context.

### AI behaviour

- protect valuable players before final year when appropriate
- deliberately sell if renewal is unlikely
- become more aggressive around expiring targets
- avoid endlessly renewing players beyond plausible retirement age

### Acceptance

- valuable players no longer disappear accidentally
- some stars still leave on frees when circumstances justify it
- renewal outcomes vary by save context, not by script
- rejected renewal creates downstream selling/replacement behaviour

## 5. Phase 2 — Loan Engine

### Loan state machine

`available -> interest -> proposal -> negotiation -> active-loan -> completed/recall/converted`

### Terms

- start/end date
- wage contribution
- loan fee
- expected playing time
- preferred position/role
- option to buy
- obligation conditions
- future fee
- buyback when relevant
- recall eligibility/window

### Destination scoring

- expected minutes
- competition level
- tactical fit
- position fit
- coaching/development environment
- physical/technical development need
- geography/adaptation
- parent club relationship

### Recall logic

Recall only when context supports it:

- promised minutes not delivered
- serious injury crisis at parent club
- player is being used in wrong role
- development environment is poor
- contractual recall window is open

### Acceptance

- young players are not loaned randomly
- loans produce development pathways
- parent clubs can explain why a loan was selected or recalled

## 6. Phase 3 — Selling AI

Buying intelligence and selling intelligence share the same squad plan.

### Player status model

- untouchable
- important but available only for exceptional fee
- available at market value
- actively for sale
- development list / loan
- contract-risk sale

### Sell score inputs

- tactical relevance
- depth at position
- age curve
- current ability/potential
- minutes pathway
- contract remaining
- player happiness
- replacement availability
- club financial pressure
- market demand
- homegrown/registration value

### Financing chain

A club may sell Player A because it needs funds for Requirement B. The event ledger records the link so the transfer story is causal.

### Acceptance

- clubs stop hoarding positions
- clubs do not empty critical positions without replacement strategy
- selling a starter can create a new recruitment requirement immediately

## 7. Phase 4 — Happiness + Promises + Dressing-room reactions

### Happiness dimensions

Do not store one magic morale number only. Maintain components:

- playing time satisfaction
- contract satisfaction
- role satisfaction
- manager trust
- club ambition satisfaction
- transfer-treatment satisfaction
- adaptation/home comfort
- team performance sentiment

Aggregate sentiment is derived from components.

### Promise state machine

`offered -> accepted -> tracking -> fulfilled/broken/excused -> reaction`

Promise types:

- playing time
- preferred role/position
- strengthen position
- loan pathway
- new contract
- allow transfer under conditions
- squad status

### Reaction severity

Contextual severity: mild / material / severe. Personality, relationship, importance and how close the club came to fulfilling the promise modify reaction.

### Emergent events

- asks for more minutes
- asks for contract
- requests loan
- transfer request
- upset after rejected elite-club offer
- happy after pathway opens
- captain/leader reaction to major squad action

### Acceptance

No binary tantrum machine. Similar events can create different but explainable reactions.

## 8. Phase 5 — Global availability, injuries, suspensions, fatigue and form

### Availability model

- injury type/severity
- expected recovery range
- recurrence risk
- suspension reason/matches
- fatigue
- match load
- sharpness
- current form

### Injury risk

Driven by:

- minutes/load
- recovery days
- age
- injury-proneness identity trait
- tactical intensity
- previous injuries
- controlled uncertainty

### Cross-system effects

`key ST injured 4 months -> squad analysis -> injury-replacement requirement -> market activity`

`player returns -> temporary requirement may close`

Form affects lineup selection; match importance changes rotation priority.

### Acceptance

Injuries influence real decisions across every AI club, not just UI messages.

## 9. Phase 6 — Club Finance + Rules

Needed before long careers become trustworthy.

### Finance state

- cash
- transfer budget
- wage budget
- committed wages
- transfer installments
- future obligations
- income
- transfer income
- debt where applicable

### Constraints

- registration rules by competition
- homegrown constraints where applicable
- association/competition financial rules
- squad limits
- embargo/restrictions state

### AI effects

Financial pressure changes recruitment/selling rather than merely displaying red numbers.

## 10. Phase 7 — Living Manager Market

Managers become first-class world entities with their own employment and career history.

### Manager state

- reputation
- tactical vision
- formation preferences
- youth trust
- rotation tendency
- recruitment preferences
- personality/tendencies
- job security
- tenure
- achievements
- relationships where needed

### Club board evaluation

- objective difficulty
- league performance vs expectation
- cup performance
- tactical/club-vision alignment
- squad development
- finances
- fan pressure (later)

### Job market

`secure -> pressure -> very insecure -> sacked`

Then:

`caretaker -> shortlist -> interviews/evaluation -> hire`

Manager fit considers:

- reputation
- current/former club level
- tactical vision vs club identity
- nationality/league familiarity
- tenure and willingness to move
- recent achievements
- compensation/availability

### Critical ripple

`new manager -> new tactical plan -> new squad requirements -> new shortlist + new surplus list`

Manager tendencies evolve from career behaviour instead of remaining frozen forever.

## 11. Phase 8 — League Simulation Tiers

All relevant leagues exist in the world, but not all need identical computational depth.

### Tier 1 — detailed

- user's league
- current European competition participants relevant to user
- optionally pinned leagues

Runs full lineup-aware simulation, detailed player stats, fatigue/form and tactical decisions.

### Tier 2 — standard

Major selected leagues.

Runs lineup/strength simulation with player minutes, goals, assists, cards, injuries and form, but less tactical event detail.

### Tier 3 — lightweight

Rest of loaded world.

Runs fixture/weekly aggregate simulation sufficient for:

- table
- club form
- player season stats
- injuries/availability
- transfer reputation/development signals
- promotion/relegation

Transfer, contract and manager systems remain global regardless of match simulation tier.

### Dynamic promotion

A Tier 3 league can be promoted temporarily when:

- user moves there
- club enters a competition against user
- player is heavily scouted
- user pins league

### Acceptance

Real Madrid, Dortmund, Benfica and Ludogorets have league context and real consequences without requiring Premier-League-level CPU cost for every match.

## 12. Phase 9 — Development + Aging

### Development inputs

- age curve
- potential ceiling/range
- minutes
- match level
- training/coaching environment
- role/position training
- happiness
- development personality
- injury interruptions
- manager youth trust

### Development identities

Stable hidden curve types can include:

- early developer
- normal
- late developer
- physically early / technically late variants

Do not expose exact future curve to user.

### Aging

Decline is attribute-sensitive and non-linear. Physical decline normally precedes some technical/mental decline, with player-specific variance.

### Acceptance

The database should not remain frozen in 2026 and growth must not become universally linear.

## 13. Phase 10 — Retirement + Newgens

### Retirement intent

Depends on:

- age
- ability level
- injuries
- contract situation
- playing time
- ambition/stability personality
- availability of credible offers

### Newgens

Generated from club/nation youth ecosystems, not as direct replacements for retired stars.

Inputs:

- club academy reputation
- nation talent pool
- facilities/youth recruitment later
- positional demand/distribution
- football culture profile

Newgens receive stable identity seeds and PlayerBrains at birth.

### Acceptance

Player population, positional distribution and talent supply remain healthy over long horizons.

## 14. Phase 11 — Narrative layer and UI

Only after systems produce reliable state.

The event ledger feeds:

- Home news
- transfer rumours
- social/media cards
- Inbox
- decision interrupts
- player conversations
- manager stories
- league stories

Narrative text never changes the simulation result; it explains it.

Important events may pause calendar processing:

- user transfer offer requiring response
- broken/urgent promise
- serious player issue
- board decision
- contract deadline

Routine world activity stays in the live processing ticker/news feed.

## 15. Long-term season architecture

Current 2026/27 fixed-season code must evolve into a season service.

Required services:

- `SeasonCalendar`
- `CompetitionRegistry`
- `FixtureGenerator/Loader`
- `SeasonRollover`
- `PromotionRelegation`
- `EuropeanQualification`
- `ContractYearBoundary`
- `YouthIntake`
- `RetirementWindow`
- `BudgetReset/BoardTargets`

Season rollover must never recreate the world. It advances the existing world.

## 16. Proposed module map

```text
src/career-world/
  realism/
    realism-audit.js
    realism-baselines.js
    realism-reason-codes.js
  contracts/
    contract-engine.js
    renewal-ai.js
    agent-engine.js
  loans/
    loan-engine.js
    loan-destination-ai.js
  transfers/
    selling-ai.js
    player-brain.js
    rumor-engine.js
    competition-engine.js
  players/
    happiness-engine.js
    promise-engine.js
    availability-engine.js
    form-engine.js
    development-engine.js
    retirement-engine.js
    newgen-engine.js
  managers/
    manager-market.js
    job-security.js
    hiring-ai.js
  finance/
    finance-engine.js
    registration-rules.js
  competitions/
    competition-registry.js
    simulation-tiers.js
    season-rollover.js
```

## 17. Delivery gates for every phase

A phase is not complete because its code exists.

It is complete only when:

1. same-seed deterministic test passes;
2. different-seed diversity test passes;
3. no-scripted-world test passes;
4. persistence/migration test passes;
5. Realism Lab has no new hard violations;
6. performance stays inside budget;
7. at least one causal integration test proves the system changes another system;
8. event ledger exposes reason codes;
9. UI reads authoritative state rather than duplicating logic.

## 18. No-scripted-world rule

Algorithm modules must not contain player-name or club-name transfer outcomes.

Club-specific real identity belongs in data/profile files, for example tactical/recruitment identity. The algorithm consumes profiles but cannot contain `if Real Madrid then buy X` logic.

Add an automated repository test that scans simulation algorithms for forbidden hardcoded player names and scripted club-to-player outcomes.

## 19. Execution order

1. World Realism Lab V1 + observability
2. Contracts + Agents
3. Loan Engine
4. Selling AI
5. Happiness + Promises
6. Global injuries/suspensions/fatigue/form
7. Finance + registration/competition rules
8. Living Manager Market
9. League Simulation Tiers + competition state
10. Season rollover
11. Development + Aging
12. Retirement + Newgens
13. World Realism Lab V2 (`100 saves × 5 seasons`)
14. Market/World UI completion
15. Continuous calibration and regression testing

## 20. Definition of the target experience

After five seasons, opening a save should reveal a world that is different from another save but still recognisably football:

- clubs retain institutional identity while evolving with managers and circumstances;
- managers have careers and change clubs;
- squad building follows needs rather than hoarding;
- player careers react to minutes, form, contracts, injuries and ambition;
- rumours often die; some become bidding wars;
- loans have purpose;
- finances constrain decisions;
- league results change reputations and recruitment;
- young players develop differently;
- veterans decline and retire;
- new players enter the world;
- every important event has a causal explanation in the ledger.

That is the quality bar.