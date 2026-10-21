# Thinking effort: `high` (default) vs `medium`

**Summary:** `medium` answered the five README questions 17% faster (68.7s → 56.7s) by skipping hidden thinking
before the final answer. No factual errors were found at `medium`, versus 4 at `high`. That's one run per setting,
so the takeaway is "faster with no quality loss found", not "more accurate".

The five README questions on `claude-sonnet-5`, one run per setting. Effort was injected into each request, so
project code was unchanged during the test. Every figure in every answer was checked against `src/data.ts`.

## Results

| Question | high | medium | Factual errors (high) | Factual errors (medium) |
| --- | --- | --- | --- | --- |
| Compare Acme and Globex | 14.9s | 10.7s | 3 | 0 |
| Umbrella Health risks | 15.2s\* | 13.8s\* | 0 | 0 |
| Initech subscription transition | 10.0s | 10.4s | 0 | 0 |
| Which company is growing fastest | 11.5s | 8.2s | 0 | 0 |
| Is GLBX a better business than ITCH | 17.1s | 13.6s | 1 | 0 |
| **Total** | **68.7s** | **56.7s (−17%)** | **4** | **0** |

\* Re-run. The first run was 12.6s vs 24.4s, but the slow `medium` run's final call generated at ~30 tokens/s
instead of the usual ~100 (an API slowdown, not effort), so both settings were run again.

- At `medium` the model still usually thinks while planning tool calls, but it skipped thinking in every final
  answer call. At `high` it thought before 3 of 5 final answers. Output tokens: 5,935 → 4,864 (−18%).
- `medium` also handled the ambiguous "Acme" better: it covered both Acme Corp and Acme Robotics, while `high`
  answered for Acme Corp and mentioned Acme Robotics in a footnote.

### Errors found (all at `high`)

1. Compare Acme and Globex: lists Acme Corp's YoY growth as "7.3% → 6.8% → 5.7% → 2.6% → 5.5%" and calls it
   "consistent acceleration". The data has four periods (7.3%, 5.7%, 2.6%, 5.5%); 6.8% doesn't exist, and growth
   slowed.
2. Same answer: "gross margin expanded 381bps (38.1% → 39.7%)". That's 160bps.
3. Same answer: Globex's "operating margin held roughly flat (~9.9%)". It rose from 8.9% to 9.9%.
4. GLBX vs ITCH: "Margins are more than double across the board". Only gross margin is (74.8% vs 30.4%);
   operating, net and FCF margins are ~1.8×.

Minor, not counted: GLBX vs ITCH gives Globex's FY21–24 revenue CAGR as ~1.3% (actual 1.2%); the Initech answer
says subscription was "the minority a few years ago", which the data doesn't show.

### Caveats

- One run per setting (plus one re-run). The sample is too small to show `medium` is *more* accurate; the finding
  is that no quality regression was found.
- Latency varies between runs; one 2× outlier appeared in twelve runs.

## Proposed change (not merged)

Typechecked, then reverted:

```diff
@@ -7,6 +7,7 @@ import { companies } from "./data.ts";
 import { executeToolCalls, toolSchemas } from "./tools.ts";
 
 const MODEL = process.env.ROGO_MODEL ?? "claude-sonnet-5";
+const EFFORT = (process.env.ROGO_EFFORT ?? "medium") as Anthropic.OutputConfig["effort"];
 const MAX_ITERATIONS = 12;
 
 const client = new Anthropic();
@@ -58,6 +59,7 @@ export async function runAgent(
     const response = await client.messages.create({
       model: MODEL,
       max_tokens: 16000,
+      output_config: { effort: EFFORT },
       system: SYSTEM_PROMPT,
       tools: toolSchemas,
       messages,
```

## Answers

### Compare Acme and Globex and tell me which one appears to be growing faster.

<details>
<summary><code>high</code>, 14.9s, tools: 2</summary>

**Acme Corp is growing meaningfully faster than Globex on every key metric.**

**Revenue (FY21→FY25 CAGR)**
- Acme: $1.84B → $2.26B = **~5.3% CAGR** (steady, consistent y/y acceleration: 7.3% → 6.8% → 5.7% → 2.6% → 5.5%)
- Globex: $8.42B → $8.91B = **~1.4% CAGR** (lumpier, even dipped in FY23: 8.42→8.61→8.40→8.72→8.91)

**Profitability growth (FY21→FY25)**
- Acme net income: $152.5M → $203.4M (**+33%**, ~7.5% CAGR)
- Globex net income: $554.5M → $649.7M (**+17%**, ~4.0% CAGR)

**Margin trajectory**
- Acme gross margin expanded 381bps (38.1% → 39.7%) and operating margin rose from 11.2% to 12.2%
- Globex gross margin expanded a similar 160bps (29.2% → 30.8%) but off a much lower base, and operating margin held roughly flat (~9.9%)

**Free cash flow**
- Acme: $125.7M → $167.6M (**+33%**)
- Globex: $457.1M → $535.6M (**+17%**)

**Bottom line:** Acme Corp is compounding revenue roughly 4x faster than Globex, converting that into disproportionately larger gains in net income and free cash flow, while also expanding margins more. Globex is far larger in absolute scale ($8.9B vs $2.3B revenue) but is essentially a low-single-digit grower, consistent with its mature, diversified-conglomerate profile — whereas Acme's focused industrial-automation exposure is delivering high-single-digit top-line growth with operating leverage.

*(Note: if you meant Acme Robotics (ACMR) rather than Acme Corp, let me know — it's a separate company in our coverage with no ties to Acme Corp, and I can pull its financials instead.)*

</details>

<details>
<summary><code>medium</code>, 10.7s, tools: 3</summary>

## Acme Corp (ACME) is growing faster than Globex — but note there are two "Acme" names in coverage, so I've included both for clarity.

**Quick answer:** Acme Corp's revenue is compounding at roughly 5.3% per year vs. Globex's ~1.4%, and Acme's profitability is scaling faster too. (Acme Robotics — a separate, unrelated company — is growing far faster than both, at ~48% CAGR, in case that's the "Acme" you meant.)

### Revenue growth, FY2021–FY2025
| Company | FY21 Rev | FY25 Rev | CAGR |
|---|---|---|---|
| **Acme Corp (ACME)** | $1,840M | $2,260M | **~5.3%** |
| **Globex Inc (GLBX)** | $8,420M | $8,905M | **~1.4%** |
| *Acme Robotics (ACMR, unaffiliated)* | *$210M* | *$1,015M* | *~48%* |

### Supporting detail
- **Acme Corp**: Revenue has risen every year with no dips ($1,840M → $1,975M → $2,088M → $2,143M → $2,260M). Operating income grew from $206M to $275M (+33%), and gross margin expanded steadily from 38.1% to 39.7% — a sign of improving unit economics alongside growth.
- **Globex**: Revenue is essentially flat-to-up — it actually *declined* in FY2023 ($8,610M → $8,395M) before recovering to $8,905M by FY2025. Operating income grew a bit faster than revenue (from $749M to $878M, +17%) thanks to modest margin expansion (29.2% → 30.8%), but top-line growth is clearly the laggard.
- Both companies show similar quarterly seasonality (Q4 strongest), so the comparison isn't distorted by timing effects.

**Bottom line:** On revenue, operating income, and net income growth, Acme Corp is outpacing Globex by a wide margin — Globex's scale (~4x Acme's revenue) comes with much slower growth, consistent with its profile as a large, diversified industrial conglomerate versus Acme's more focused automation business.

</details>


### What are the biggest risks Umbrella Health flags in its filings?

<details>
<summary><code>high</code>, 15.2s, tools: 6</summary>

Based on the available filings and earnings materials, Umbrella Health's biggest flagged risks center on its **acquisition-dependent growth model** and **reimbursement exposure**:

**1. Reliance on M&A for growth, not organic expansion**
- Acquisitions drove ~6.5 points of the 9.6% consolidated revenue growth in FY2025 — i.e., roughly two-thirds of total growth.
- Same-clinic (organic) revenue growth was only 3.1%, underscoring how dependent reported growth is on deal flow.
- The company explicitly flags risk around its ability to keep finding suitable clinic groups at acceptable valuations and integrating them "without disruption to patient volumes." FY2026 guidance of 8–10% growth again assumes roughly half coming from acquisitions already under LOI — meaning a slowdown in deal-making would directly hit the growth algorithm.

**2. Government reimbursement rate exposure**
- Government reimbursement represented ~41% of Clinic Operations revenue in FY2025, making the business sensitive to rate changes/policy shifts outside its control.

**3. Integration and cost pressure**
- Operating margin slipped 20 bps to 7.4% in FY2025, attributed to acquisition integration costs and nursing wage inflation — a near-term margin risk tied directly to the acquisitive strategy.

**Bottom line:** The core risk theme is that Umbrella Health's growth story is structurally acquisition-driven with thin organic growth underneath it, layered on top of reimbursement-rate sensitivity and rising labor/integration costs — any disruption to deal supply, financing, or reimbursement policy would expose how much of the top line is "bought" rather than earned.

</details>

<details>
<summary><code>medium</code>, 13.8s, tools: 6</summary>

## Umbrella Health (UMBR) — Key Risks Flagged in Filings

**1. Dependence on acquisition-led growth, not organic expansion**
Umbrella's growth story is heavily inorganic: acquisitions contributed ~6.5 points of the 9.6% consolidated revenue growth in FY2025, while same-clinic (organic) revenue growth was only 3.1%. The 10-K explicitly flags that sustaining growth depends on finding suitable clinic groups at acceptable valuations and integrating them without disrupting patient volumes — a risk that compounds as the pipeline of attractive regional targets could thin out or get pricier.

**2. Integration execution risk**
FY2025 saw 27 of 34 new clinic locations come from two acquisitions closed mid-year. Management cited integration costs (alongside nursing wage inflation) as a direct drag on operating margin, which fell 20 bps to 7.4%. This is a near-term, visible cost of the M&A strategy, not just a hypothetical.

**3. Government reimbursement exposure**
Roughly 41% of Clinic Operations revenue is tied to government reimbursement rates. Any adverse changes in these rates would hit a meaningful chunk of the business directly.

**4. Forward growth is also acquisition-dependent**
Guidance for FY2026 (8–10% revenue growth) assumes roughly half comes from acquisitions already under letter of intent — meaning the company's near-term outlook, not just its history, carries deal-completion risk.

**Bottom line:** The dominant theme across the filings is M&A dependency — both as a historical driver of growth and a forward-looking risk (sourcing deals, integration costs, margin dilution) — compounded by meaningful exposure to government reimbursement policy in the larger Clinic Operations segment.

</details>

<details>
<summary><code>high, first run</code>, 12.6s, tools: 6</summary>

## Umbrella Health (UMBR) — Key Risks Flagged in Filings

**1. Acquisition dependency** — Growth is heavily reliant on M&A rather than organic expansion. In FY2025, acquisitions contributed ~6.5 of the 9.6 percentage points of consolidated revenue growth. The 10-K explicitly flags the risk of sustaining this: finding suitable clinic groups at acceptable valuations and integrating them "without disruption to patient volumes."

**2. Government reimbursement exposure** — Government reimbursement rates represented ~41% of Clinic Operations revenue in FY2025, leaving earnings sensitive to policy/rate changes outside the company's control.

**3. Integration costs & wage inflation compressing margins** — Per the Q4 FY2025 earnings call, operating margin slipped 20 bps (to 7.4%) due to integration costs from two regional acquisitions closed mid-year plus wage inflation in nursing staff — a near-term profitability risk tied directly to the acquisition strategy.

**Supporting context:**
- Same-clinic (organic) revenue growth was only 3.1% in FY2025, well below the 9.6% total — underscoring how much of the top line is acquisition-driven rather than underlying demand growth.
- FY2026 guidance (8–10% revenue growth) is again roughly half-dependent on acquisitions "already under letter of intent," meaning deal execution risk carries directly into next year's outlook.
- Financials show steady margin expansion (gross margin 25.9% in FY2025 vs. 24.3% in FY2021) and FCF growth to $224M, suggesting the company has absorbed these risks reasonably well so far — but the structural reliance on deal flow and reimbursement rates remains the core vulnerability.

</details>

<details>
<summary><code>medium, first run</code>, 24.4s, tools: 5</summary>

## Umbrella Health (UMBR) — Key Risks Flagged in Filings

**1. Acquisition-dependent growth**
Umbrella's growth story is heavily reliant on M&A rather than organic expansion. In FY2025, acquisitions contributed ~6.5 of the 9.6 percentage points of total revenue growth (consolidated revenue +9.6% to $4.4B). The company explicitly flags risk around its ability to keep finding suitable clinic groups at acceptable valuations and integrating them without disrupting patient volumes.

**2. Integration execution risk**
Of the 34 new clinic locations added in FY2025, 27 came from two regional acquisitions closed mid-year. Management cited integration costs and nursing wage inflation as drags on margin — operating margin fell 20bps to 7.4% despite revenue growth, showing integration isn't margin-neutral.

**3. Government reimbursement exposure**
Roughly 41% of Clinic Operations revenue came from government reimbursement rates in FY2025. Changes to these rates represent a direct and sizable risk to the largest segment (Clinic Operations is 64% of total revenue).

**4. Underlying organic growth is modest**
Same-clinic (organic) revenue growth was just 3.1% in FY2025, underscoring how dependent the overall growth rate is on continued deal flow — a risk if acquisition pricing, financing, or available targets become less favorable.

**Forward-looking concern:** Management guided FY2026 revenue growth of 8–10%, with roughly half expected to come from acquisitions already under LOI — meaning the acquisition-dependency risk is set to persist rather than diminish.

</details>


### How is Initech's subscription transition going?

<details>
<summary><code>high</code>, 10.0s, tools: 3</summary>

## The subscription transition is progressing well, though revenue recognition questions on recent deals bear watching

**Mix shift is accelerating as planned:**
- Subscription revenue = 62% of total in FY2024, up from being the minority a few years ago
- Preliminary FY2025 guidance puts subscription at **~68%** of revenue
- Perpetual license (19% of FY2024 mix) is deliberately being wound down — it declined 19% in FY2024 as expected

**Growth and retention metrics are healthy:**
- FY2024 revenue: $988M, +14.8% y/y — the third straight year of low-to-mid teens growth
- Subscription revenue specifically grew **26%** in FY2024
- **Net revenue retention of 112%**, a solid signal of expansion within the existing base
- Management says it has **not discounted to pull conversions forward**, suggesting the growth is organic/durable rather than engineered

**Profitability has tracked up alongside the mix shift** (a good sign — subscription transitions often pressure margins near-term):
- Gross margin: 73.6% (FY21) → 74.8% (FY24)
- Operating income: $107.5M → $173.1M
- Free cash flow: $65.6M → $105.6M

**FY2025 outlook (preliminary, from 1/30/26 8-K):**
- Revenue guided to $1.12B–$1.14B (+13-15% y/y), consistent with the recent growth trend

**One flag worth monitoring:** Initech disclosed its FY2025 10-K will be **delayed** as it reviews **revenue recognition on a batch of multi-year contracts signed in Q4** — final results "may differ materially" from the preliminary figures. Given the transition is built on growing multi-year subscription contracts, this is worth tracking closely before treating the preliminary 68% subscription mix / revenue guide as final.

</details>

<details>
<summary><code>medium</code>, 10.4s, tools: 2</summary>

## Initech's Subscription Transition: On Track, Growing Steadily

**Bottom line:** The shift from perpetual licenses to subscription is progressing well — subscription mix has grown from roughly 62% of revenue in FY2024 to a guided ~68% in FY2025 — but there's a near-term overhang from a revenue recognition review that's delaying the FY2025 10-K.

### Supporting detail

**Revenue growth has been consistent:**
- FY2021: $640M → FY2024: $988M (14.8% growth in FY2024, third straight year of low-to-mid teens growth)
- FY2025 preliminary guidance: $1.12–1.14B (13-15% growth)

**Mix shift is the key story:**
- FY2024: Subscription revenue +26%, perpetual license revenue -19% — exactly the pattern you'd expect in a healthy transition
- Subscription mix: ~62% (FY2024) → ~68% guided (FY2025)
- Net revenue retention of 112% (as of FY2024 Q4) suggests existing subscription customers are expanding, not just replacing lost license revenue

**Margins are expanding alongside the mix shift:**
- Gross margin has ticked up steadily: 73.6% (FY2021) → 74.8% (FY2024), consistent with subscription's higher-margin profile
- Operating income has grown faster than revenue (FY2024: $173M, up from $107M in FY2021)

**Management's framing:** Leadership has been disciplined, explicitly noting they haven't used discounting to "pull forward" conversions — a reasonable signal that growth is coming from genuine demand rather than aggressive deal structuring.

### One caveat to flag
The January 2026 8-K disclosed that Initech's FY2025 10-K will be **delayed** while it reviews revenue recognition on a set of multi-year contracts signed in Q4 2025. This is worth monitoring — it could relate to how the company is recognizing subscription revenue on new multi-year deals, which is directly relevant to the transition story. Final FY2025 numbers "may differ materially" from the preliminary guidance given.

</details>


### Which company in the universe is growing fastest?

<details>
<summary><code>high</code>, 11.5s, tools: 5</summary>

**Acme Robotics (ACMR)** is growing by far the fastest in the coverage universe.

**Revenue CAGR, FY2021–FY2025:**
| Company | Revenue FY21 → FY25 ($M) | 4-Yr CAGR |
|---|---|---|
| **Acme Robotics** | 210 → 1,015 | **~48%** |
| Initech* | 640 → 988 (FY21–24) | ~16% |
| Umbrella Health | 3,120 → 4,395 | ~9% |
| Acme Corp | 1,840 → 2,260 | ~5% |
| Globex Inc | 8,420 → 8,905 | ~1% |

*Initech's FY2025 hasn't been filed yet, so its figure is a 3-year CAGR through FY2024.

**Why it stands out:** Acme Robotics' revenue has grown nearly 5x in four years (from $210M to just over $1B), with YoY growth consistently above 40% every year. It's also expanding profitably — operating margin improved from ~4% to ~5%, and gross margin ticked up from 51.4% to 53.0% — suggesting the growth isn't just being bought with margin give-up. This fits its position as a newer-economy robotics/software player selling into contract manufacturing and logistics, versus the more mature, single-digit-growth industrial names (Acme Corp, Globex) and the steady-but-slower acquisitive growth at Umbrella Health.

</details>

<details>
<summary><code>medium</code>, 8.2s, tools: 5</summary>

**Acme Robotics (ACMR) is growing fastest by a wide margin.**

Revenue CAGR 2021–2025:
- **Acme Robotics: ~48%** (revenue up from $210M to $1,015M; FY25 alone grew ~47% YoY, from $690M to $1,015M)
- Initech: ~16% (2021–2024, $640M→$988M; FY25 not yet reported)
- Umbrella Health: ~9% ($3,120M→$4,395M)
- Acme Corp: ~5% ($1,840M→$2,260M)
- Globex Inc: ~1.4% ($8,420M→$8,905M)

Acme Robotics' growth is also broad-based and accelerating — every annual revenue increase has been larger in dollar terms than the last (e.g., +$95M in 2022, +$147M in 2023, +$238M in 2024, +$325M in 2025), and operating margin has expanded alongside it (from 4.1% to 5.1% of revenue), indicating the growth isn't coming at the expense of profitability. It's a much smaller base than the rest of the group (~$1B in revenue vs. Globex's ~$9B), which helps explain the higher growth rate, but even adjusting for scale it's the clear standout — next-closest grower (Initech) is compounding at roughly a third of Acme Robotics' rate.

</details>


### Is GLBX a better business than ITCH?

<details>
<summary><code>high</code>, 17.1s, tools: 4</summary>

**Short answer: By classic "quality of business" metrics (margins, growth, recurring revenue), Initech is the better business — Globex is simply bigger and more cash-generative in absolute dollars.**

| Metric (FY2024) | Globex (GLBX) | Initech (ITCH) |
|---|---|---|
| Revenue | $8.72B | $988M |
| Revenue CAGR '21–'24 | ~1.3%/yr | ~15.6%/yr |
| Gross margin | 30.4% | 74.8% |
| Operating margin | 9.6% | 17.5% |
| Net margin | 7.1% | 13.0% |
| FCF margin | 5.9% | 10.7% |

**Why Initech screens better as a business:**
- **Margins are more than double** across the board (gross, operating, net, FCF) — typical of a software model vs. a capital/materials-intensive industrial conglomerate.
- **Growth is far faster** (~15-16% revenue CAGR vs. ~1-3% for Globex, which has been essentially flat-to-cyclical since 2021).
- **Revenue quality is improving**: Initech now gets 62% of revenue from subscription, up from a legacy perpetual-license model — a shift toward recurring, higher-visibility revenue.
- **Asset-light**: 3,050 employees generating $988M vs. Globex's 41,300 employees generating $8.7B — Initech produces far more revenue and profit per employee/dollar of invested capital.

**Where Globex has the edge:**
- **Scale and diversification** — three largely uncorrelated end markets (energy equipment, building products, specialty chemicals) and ~50% international mix provide more stability against any single-market downturn.
- **Absolute free cash flow** is far larger ($536M vs. $106M), which matters for capital-intensive growth, M&A, or dividend capacity.
- **Track record/duration** — founded 1911 vs. 1996, with a long history of steady (if unspectacular) profitability through cycles.

**Caveat:** Initech's FY2025 hasn't been filed yet — only a preliminary 8-K guidance update exists — so the comparison above uses FY2024 actuals for Initech against FY2025 actuals for Globex. Also note FY2023 professional-services revenue at Initech is flagged unaudited.

**Bottom line:** If "better business" means unit economics, growth, and recurring-revenue quality, Initech wins decisively. If it means scale, diversification, and absolute cash generation, Globex wins. Given Initech's much higher margins and growth trajectory, most analysts would call it the structurally superior business, even though Globex is the more mature, lower-risk cash machine.

</details>

<details>
<summary><code>medium</code>, 13.6s, tools: 4</summary>

## It depends on the lens — Initech is the better *business*, Globex is the more *resilient scale compounder*

**Verdict:** On quality metrics (margins, growth, capital-light model), **ITCH wins decisively**. On scale, cash generation, and durability, **GLBX wins**. If forced to pick one "better business" in the classic sense (returns on capital, growth, margin structure), it's **Initech**.

### The numbers

| Metric | Globex (GLBX) | Initech (ITCH) |
|---|---|---|
| Revenue (FY24) | $8,720M | $988M |
| Revenue growth ('21→'24 CAGR) | ~1.2% | ~15.6% |
| Gross margin | ~30% | ~75% |
| Operating margin (FY24) | ~9.6% | ~17.5% |
| FCF margin (FY24) | ~5.9% | ~10.7% |
| FCF growth ('21→'24 CAGR) | ~3.8% | ~17.2% |

### Why Initech looks like the better business
- **Margin structure**: ~75% gross margin vs. Globex's ~30% — typical software economics vs. capital-intensive industrials.
- **Growth**: Revenue has compounded ~15-16%/year, more than 10x Globex's low-single-digit growth.
- **Capital efficiency**: Smaller revenue base but converting far more of it to free cash flow (margin nearly double Globex's), with FCF growing much faster.
- **Mix shift tailwind**: Moving from perpetual licenses to subscription (62% of revenue now subscription) should further improve recurring revenue quality and margins over time.

### Why Globex still matters
- **Scale and diversification**: $8.9B revenue (FY25) across energy equipment, building products, and specialty chemicals, with ~half international — a much larger, more diversified cash-generating base ($536M FCF in FY25 vs. Initech's ~$106M in FY24).
- **Steady, if unspectacular, improvement**: Operating margin has crept up from 8.9% (2021) to 9.9% (2025), and FCF has grown every year — this is a mature, stable compounder, not a declining business.
- **Lower cyclicality risk is a trade-off, not a flaw**: Industrial conglomerates trade growth for ballast; Globex isn't trying to be Initech.

### Bottom line
If "better business" means higher-quality economics (margins, growth, capital-light scalability), **Initech is clearly superior**. If it means which company generates more absolute cash and offers more diversified, lower-volatility exposure, **Globex wins on scale**. Note also that Initech's FY2025 financials aren't yet filed (only preliminary guidance via 8-K), so the comparison for the most recent year is somewhat asymmetric.

</details>

