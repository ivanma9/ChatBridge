# AI Cost Analysis — ChatBridge

**Date:** April 5, 2026
**Project:** ChatBridge — a unified desktop chat client with LLM-powered tool mediation for K-12 education

---

## 1. Development & Testing Costs

### LLM API Costs During Development

| Provider | Model(s) Used | Purpose | Estimated Spend |
|----------|--------------|---------|-----------------|
| Anthropic | Claude Opus 4.6, Sonnet 4.6 | Architecture planning, code generation, debugging via Claude Code CLI | ~$320 |
| OpenAI | GPT-5-mini, GPT-4.1-mini | LLM chat integration testing, tool-calling validation | ~$25 |
| OpenAI | text-embedding-3-small | Knowledge base RAG pipeline testing | ~$2 |
| Cohere | rerank-v3.5 | Knowledge base reranking tests | ~$3 |
| Various (Qwen, DeepSeek, Mistral) | Multiple models | Provider adapter smoke tests | ~$10 |
| **Total Development Spend** | | | **~$360** |

### Token Consumption (Development & Testing)

| Category | Input Tokens | Output Tokens | Total Tokens |
|----------|-------------|---------------|--------------|
| Claude Code sessions (architecture, implementation) | ~18M | ~6M | ~24M |
| Chat completion integration tests | ~2M | ~800K | ~2.8M |
| Embedding generation (KB testing) | ~500K | N/A | ~500K |
| Tool-calling round-trips (bridge mediation) | ~1.5M | ~600K | ~2.1M |
| **Total** | **~22M** | **~7.4M** | **~29.4M** |

### API Call Volume (Development)

| Call Type | Count |
|-----------|-------|
| Chat completions (all providers) | ~3,200 |
| Embedding requests | ~850 |
| Tool-use / function-calling round-trips | ~1,400 |
| Reranking calls (Cohere) | ~200 |
| **Total API calls** | **~5,650** |

### Other AI-Related Costs

| Item | Cost |
|------|------|
| LibSQL / Turso vector DB (local dev — SQLite-based) | $0 (local) |
| Tavily web search API (testing web-search extension) | ~$5 |
| Docker Compose PostgreSQL (bridge DB, local) | $0 (local) |
| Sentry error monitoring (AI error tracking) | $0 (free tier) |
| **Subtotal** | **~$5** |

### Total Development Cost: **~$365**

---

## 2. Production Cost Projections

### Assumptions

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Sessions per user per month | 20 | K-12 classroom setting, ~1 session per school day |
| Chat messages per session | 8 | Avg conversation depth with LLM |
| Tool invocations per session | 2 | Bridge app launches, Spotify, etc. via function-calling |
| Input tokens per chat message | 1,500 | System prompt + conversation history + user message |
| Output tokens per chat message | 500 | Typical assistant response length |
| Input tokens per tool invocation | 2,000 | Tool schema + context + function call |
| Output tokens per tool invocation | 300 | Tool result + follow-up |
| KB queries per session (power users, 30%) | 1 | RAG retrieval for knowledge base users |
| Embedding tokens per KB query | 200 | Query embedding only (documents pre-embedded) |
| Reranking calls per KB query | 1 | Single rerank per retrieval |
| Default chat model | Claude Sonnet 4.6 | $3 / $15 per 1M tokens (input / output) |
| Default embedding model | text-embedding-3-small | $0.02 per 1M tokens |
| Reranking model | Cohere rerank-v3.5 | ~$1 per 1K queries |
| Bridge server hosting | Fixed | Express + PostgreSQL |
| Context compaction trigger | 60% of context window | Reduces token usage on long conversations |

### Per-User Monthly Token Estimates

**Chat completions (per user/month):**
- Input: 20 sessions x 8 msgs x 1,500 tokens = **240,000 tokens**
- Output: 20 sessions x 8 msgs x 500 tokens = **80,000 tokens**

**Tool invocations (per user/month):**
- Input: 20 sessions x 2 calls x 2,000 tokens = **80,000 tokens**
- Output: 20 sessions x 2 calls x 300 tokens = **12,000 tokens**

**Total per user/month:**
- Input: 320,000 tokens
- Output: 92,000 tokens

**Per-user LLM cost** (Claude Sonnet 4.6):
- Input: 0.32M x $3/1M = $0.96
- Output: 0.092M x $15/1M = $1.38
- **Per-user chat cost: ~$2.34/month**

**Per-user embedding cost** (30% use KB):
- 0.3 x 20 sessions x 1 query x 200 tokens = 1,200 tokens
- 0.0012M x $0.02/1M = ~$0.00
- **Per-user embedding cost: negligible**

**Per-user reranking cost:**
- 0.3 x 20 queries = 6 queries/month
- 6 / 1000 x $1 = ~$0.006
- **Per-user rerank cost: ~$0.01/month**

### Monthly Cost at Scale

| Cost Component | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|----------------|-----------|-------------|--------------|---------------|
| **LLM Chat Completions** | $234 | $2,340 | $23,400 | $234,000 |
| **Embedding Queries** | $0.05 | $0.50 | $5 | $50 |
| **Reranking (Cohere)** | $0.60 | $6 | $60 | $600 |
| **Tavily Web Search** (10% of sessions) | $4 | $40 | $400 | $4,000 |
| **Bridge Server Hosting** (Express + PostgreSQL) | $25 | $50 | $200 | $1,500 |
| **Vector DB (Turso Cloud)** | $0 | $29 | $79 | $500 |
| **Sentry Monitoring** | $0 | $26 | $80 | $300 |
| | | | | |
| **Total Estimated** | **$264/month** | **$2,492/month** | **$24,224/month** | **$240,950/month** |
| **Per-user cost** | $2.64 | $2.49 | $2.42 | $2.41 |

### Cost Sensitivity: Model Selection

The default model (Claude Sonnet 4.6) represents a mid-tier choice. Users can select any of 100+ models, significantly shifting costs:

| Model Tier | Example Model | $/1M In | $/1M Out | Monthly Cost @1K Users |
|------------|--------------|---------|----------|----------------------|
| Budget | GPT-5 Nano | $0.05 | $0.40 | ~$53 |
| Economy | GPT-4o-mini | $0.15 | $0.60 | ~$103 |
| Mid-tier (default) | Claude Sonnet 4.6 | $3.00 | $15.00 | ~$2,340 |
| Premium | GPT-5.4 | $2.50 | $15.00 | ~$2,180 |
| Ultra | Claude Opus 4.6 | $5.00 | $25.00 | ~$3,900 |
| Max | GPT-5.4 Pro | $30.00 | $180.00 | ~$26,160 |

### Cost Optimization Levers

1. **Context compaction** — Already implemented at 60% threshold. Reduces input tokens on long conversations by ~40%.
2. **Model routing** — Steer simple queries to budget models (GPT-5 Nano at $0.05/$0.40) while reserving premium models for complex tasks.
3. **Embedding caching** — Knowledge base documents are embedded once at ingestion (512-token chunks, 50-token overlap). Only query embeddings incur runtime cost.
4. **Batch processing** — KB file processing uses 50-chunk batches with 100ms delays to avoid rate limits and control burst costs.
5. **Token estimation** — Client-side `js-tiktoken` counts tokens before API calls, enabling pre-flight cost checks.
6. **Retry backoff** — Exponential backoff (1s initial, 2x factor, 5 max attempts) on 5xx errors prevents wasted retries.

### BYOK (Bring Your Own Key) Model

ChatBridge is a desktop Electron app where **users provide their own API keys**. In this architecture:

- **ChatBridge's direct LLM cost is $0** — users pay their own provider bills.
- The projections above represent **aggregate user spend**, not platform cost.
- Platform costs are limited to: bridge server hosting, vector DB, monitoring, and any centralized services (web search, reranking) if offered as managed features.

| Platform-Only Cost | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|--------------------|-----------|-------------|--------------|---------------|
| Bridge server + DB | $25 | $50 | $200 | $1,500 |
| Vector DB (Turso) | $0 | $29 | $79 | $500 |
| Monitoring (Sentry) | $0 | $26 | $80 | $300 |
| **Platform total** | **$25/month** | **$105/month** | **$359/month** | **$2,300/month** |

If managed AI features are offered (centralized web search, reranking), add those line items from the full projection table above.

---

## 3. Key Risks & Notes

- **Token cost dominates** — LLM chat completions are 90%+ of total AI cost at every scale.
- **Model choice is the biggest variable** — A user on GPT-5 Nano costs 50x less than one on Claude Opus 4.6.
- **Knowledge base costs are front-loaded** — Embedding ingestion is a one-time cost per document; runtime queries are cheap.
- **Tool mediation adds ~25% token overhead** — Function-calling schemas and round-trips add tokens beyond basic chat.
- **Context window growth** — Models like Claude Sonnet 4.6 (1M context) and GPT-5.4 (1.05M context) enable very long conversations, but costs scale linearly with input tokens. Compaction is essential.
- **Pricing volatility** — Model costs from `models.dev` snapshot (March 2026) may shift. Budget models trend cheaper over time.
