# Lotto Insights AI

> **Deploying?** See [DEPLOY.md](./DEPLOY.md) for the Cloudflare Workers
> deployment steps (build, secrets, sync scheduling, migrations).

Lotto IQ AI – Development Prompt



You are a senior software engineer, AI engineer, UI/UX designer, and data engineer.



Build a production-quality web application called Lotto IQ AI.



Mission



Create an advanced UK49 strategy analysis platform that allows users to build, execute, test, compare, and improve custom lottery strategies using historical UK49 results.



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

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://lotto-iq-insight.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a202ba7c-2cb2-4dad-a694-b55307dc9bf5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
