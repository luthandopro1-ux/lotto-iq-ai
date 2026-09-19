# Lotto Insights AI

Developed and maintained by **Lum Tech Solutions**.

> **Deploying?** See [DEPLOY.md](./DEPLOY.md) for the Cloudflare Workers
> deployment steps (build, secrets, sync scheduling, migrations).

Lotto IQ AI – Development Prompt



I'm a senior software engineer, AI engineer, UI/UX designer, and data engineer.



I'm build a production-quality web application called Lotto IQ AI.



Mission



Im  creating an advanced UK49 strategy analysis platform that allows users to build, execute, test, compare, and improve custom lottery strategies using historical UK49 results.



The platform must be modular, scalable, modern, and optimized for speed.



---



Technology Stack



Frontend



- Next.js

- React

- TypeScript

- Tailwind CSS



Backend



- Python

- FastAPI



Database



- PostgreSQL



Analytics



- Pandas

- NumPy

- scikit-learn



Charts



- Plotly



Authentication



- JWT



Deployment



- Docker

- Nginx



---



Core Modules



Dashboard



Display:



- Today's date

- Current UK49 draw session

- Historical statistics

- Strategy performance

- Recent draws

- Active strategies

- Analysis status



---



Historical Database



Store:



- Draw date

- Brunch

- Lunch

- Drive Time

- Tea Time



Each draw stores:



- Number 1

- Number 2

- Number 3

- Number 4

- Number 5

- Number 6

- Booster



Support importing and updating historical results.



---



Strategy Library



Users can create unlimited strategies.



Each strategy contains:



- Name

- Description

- Formula

- Variables

- Weight

- Status

- Notes



Strategies can be enabled or disabled.



---



Strategy Engine



Build a modular rule engine.



Each strategy runs independently.



Example rule types:



- Date × Number

- 50 − Date

- Date × Time × 49

- Split Numbers

- Reverse Numbers

- Add Digits

- Multiply Digits

- Sum Six Numbers

- Minus Booster

- Previous Draw Analysis

- Previous Three Draw Analysis



The engine must allow additional rule types without modifying existing code.



---



Analysis Engine



For every draw:



Run every active strategy.



Generate candidate numbers.



Normalize all outputs to the UK49 range (1–49).



Track which numbers are produced by multiple strategies.



Rank numbers according to configurable scoring rules.



---



Backtesting Engine



Allow users to choose:



- Date range

- Strategy

- Multiple strategies



Run historical analysis.



Display:



- Total tests

- Match counts

- Average performance

- Strategy comparison

- Historical charts



---



AI Assistance



Provide AI-powered insights about:



- Strategy overlap

- Historical trends

- Frequently recurring calculations

- Strategy performance summaries



The AI should explain its analysis and make it clear that suggestions are based on historical analysis and user-defined strategies rather than guaranteed prediction.



---



Reports



Generate:



- PDF

- Excel

- CSV



Include:



- Generated numbers

- Strategy outputs

- Historical comparisons

- Charts



---



UI



Modern dark theme.



Glassmorphism.



Responsive.



Animated dashboard.



Professional data visualizations.



Fast loading.



---



Project Structure



/frontend



/backend



/database



/ai



/strategies



/analytics



/reports



/docs



/tests



---



Coding Standards



- Clean Architecture

- SOLID principles

- Modular design

- Full API documentation

- Unit tests

- Integration tests

- Type safety

- Error handling

- Logging



---



The codebase should be easy to extend because new strategies and analysis methods will be added continuously over time.

## Development

Requires Node.js 20+ — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
if I don't have it.

### Open in VS Code

```sh
git clone <this-repository-url>
cd <repository-name>
code .
```

VS Code will prompt to install the recommended extensions
(`.vscode/extensions.json` — ESLint, Prettier, Tailwind CSS IntelliSense).
Accept that, then open a terminal in VS Code and run:

```sh
npm install
cp .env.example .env    # fill in real Supabase values — see DEPLOY.md
npm run dev
```

The app runs at **http://localhost:8080**. Common commands are wired up
as VS Code tasks too (`Terminal → Run Task…`): `dev`, `typecheck`,
`lint`, `build`, `deploy: dry run`, `deploy`. Format-on-save and
ESLint auto-fix are enabled by default via `.vscode/settings.json`.

### Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server (Node runtime, not the Worker) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config, Prettier-integrated) |
| `npm run build` | Production build → `.output/` |
| `npm run deploy:dry-run` | Build + validate the Cloudflare Worker bundle, no publish |
| `npm run deploy` | Build + `wrangler deploy` — publishes to Cloudflare |

### Pushing to git & deploying

```sh
git remote add origin https://github.com/<you>/<repo-name>.git
git push -u origin main
```

Then see **[DEPLOY.md](./DEPLOY.md)** for the full Cloudflare deployment
walkthrough — secrets, the security checklist (`ADMIN_API_KEY`,
`SYNC_WEBHOOK_SECRET`), and applying the Supabase migrations. CI
(`.github/workflows/ci.yml`) runs typecheck, lint, build, and a
Cloudflare bundle dry-run on every push and PR to `main`.
