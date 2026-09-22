# Lotto IQ

**Lotto IQ** is a production web application by **Lum Tech Solutions** for structured lottery-data analysis, strategy development, historical backtesting, and explainable prediction research.

The platform helps users explore UK49 and selected Russian lottery results, compare user-defined strategies, review historical performance, and manage analysis workspaces from one application. Lotto IQ is an analytical tool: its results are based on historical data and configured strategies and are not guaranteed predictions.

## Product capabilities

- **Dashboard:** Monitor current draw sessions, recent results, strategy activity, prediction status, and analysis summaries.
- **Historical results:** Browse and maintain UK49 and Russian lottery draw histories, including scheduled draw sessions and booster data where applicable.
- **Strategy workspace:** Create, edit, enable, disable, and organize reusable analysis strategies and formulas.
- **Analysis engine:** Run active strategies, normalize candidate numbers to the relevant lottery range, identify overlapping signals, and rank results using configurable scoring rules.
- **Backtesting:** Test one or more strategies over historical date ranges and compare match counts, performance summaries, and trend charts.
- **Predictions and bankers:** Review generated candidate numbers, frequently surfaced numbers, session-level results, and historical matches.
- **Research and insights:** Generate structured analytical summaries that explain strategy overlap, recurring calculations, historical trends, and performance patterns.
- **Accounts and workspaces:** Support authenticated customer workspaces, private strategy visibility, entitlements, notification preferences, and administrative controls.
- **Data synchronization:** Keep supported lottery datasets current through protected scheduled synchronization endpoints and audited ingestion flows.

## Technology

- **Application:** TanStack Start, React, TypeScript, and Vite
- **UI:** Tailwind CSS, Radix UI, Lucide, and Recharts
- **Data platform:** Supabase PostgreSQL, migrations, row-level security, and scheduled jobs
- **Runtime:** Cloudflare Workers through Nitro
- **Validation and tooling:** ESLint, Prettier, TypeScript, and Vitest

## Repository structure

| Path | Purpose |
| --- | --- |
| `src/routes/` | File-based application routes and API endpoints |
| `src/components/` | Shared interface components and application shells |
| `src/lib/` | Server-side services, analysis logic, integrations, and utilities |
| `supabase/migrations/` | Database schema, policy, seed, and operational migrations |
| `public/` | Static assets, icons, and web-app metadata |
| `analytics-service/` | Supporting analytics service configuration and documentation |
| `docs/` | Deployment, security, analytics, and operational documentation |

## Local development

### Prerequisites

- Node.js 20 or newer
- npm
- A Supabase project for application data and authentication
- Cloudflare Wrangler for Worker preview or deployment

### Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Use the environment template as the source of truth for required configuration. Never commit real credentials, service-role keys, administrator keys, or webhook secrets.

### Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The preferred local Worker smoke test is:

```bash
npm run preview
```

## Deployment

Lotto IQ is configured for deployment to Cloudflare Workers. See [DEPLOY.md](./DEPLOY.md) for the complete deployment sequence, required secrets, protected mutation rules, scheduled synchronization, and Supabase migration instructions.

Before making a production URL public:

1. Configure the required Supabase and administrative secrets.
2. Configure a separate synchronization webhook secret.
3. Apply the Supabase migrations.
4. Run the build and Worker smoke test.
5. Confirm that protected mutations fail closed without the required administrator key.

## Security and data handling

Read-only analysis pages may be public, while data mutations, synchronization, and credit-consuming analysis operations are protected by server-side configuration. Keep secrets in the deployment provider's secret store and review the security documentation in [`docs/`](./docs/) before production deployment.

The application handles lottery results and user-created analytical strategies. It should not be presented as a guarantee of future lottery outcomes or as financial advice.

## Contributing

Create a focused branch from `main`, make a small reviewable change, run the quality checks above, and open a pull request with:

- a concise summary of the change;
- the user or operational problem it addresses;
- test and verification results; and
- any migration, environment, or deployment considerations.

Use clear conventional commit subjects such as `feat:`, `fix:`, `docs:`, `refactor:`, or `chore:`.

## Ownership

Lotto IQ is developed and maintained by **Lum Tech Solutions**.

## License

The repository is currently maintained as a private application codebase. Confirm licensing and redistribution terms with Lum Tech Solutions before publishing or reusing the source.
