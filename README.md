# insurance-ai

Projet d'apprentissage : agents IA avec NestJS, LangChain, AWS Bedrock, RAG et PostgreSQL/pgvector.

## Prérequis

- Node.js 22 et npm
- Docker Desktop (avec Docker Compose)
- Accès AWS configuré localement, avec les autorisations Bedrock pour Claude Haiku 4.5 et Titan Text Embeddings V2

## Installation

1. Installer les dépendances :

   ```bash
   npm install
   ```

2. Créer un fichier `.env` à la racine du projet (ne pas le committer) :

   ```dotenv
   DATABASE_URL=postgresql://insurance:local_dev_password@localhost:5432/insurance_ai
   BEDROCK_AWS_REGION=us-east-1
   BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0
   ```

   Adapter `DATABASE_URL` aux identifiants et au port définis dans `compose.yaml`. Configurer les identifiants AWS avec le mécanisme habituel (profil AWS CLI, SSO ou variables d'environnement) ; ne pas les placer dans le dépôt.

3. Démarrer PostgreSQL avec pgvector :

   ```bash
   docker compose up -d
   ```

4. Initialiser les tables documentaires (depuis **Git Bash**, à la racine du projet) :

   ```bash
   npm run db:init
   ```

   Cette commande exécute `db/init.sql`, qui crée l'extension `vector` et les tables `insurance_documents` et `document_chunks` si elles n'existent pas. Elle n'efface pas les données existantes.

5. Indexer les contrats fictifs pour activer la recherche RAG :

   ```bash
   node --env-file=.env scripts/index-documents.mjs
   ```

   Cette étape génère les embeddings via Amazon Titan et peut entraîner de petits frais AWS. Éviter de la relancer inutilement.

## Démarrer l'application

```bash
npm run start:dev
```

L'API est accessible par défaut à `http://localhost:3000`. Les tables de mémoire conversationnelle sont initialisées par LangGraph (`PostgresSaver.setup()`) au démarrage.

### Vérifier le fonctionnement

```bash
curl -s http://localhost:3000/agents/bedrock/ask \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"demo-001","question":"Is water infiltration through foundations covered?"}'
```

Pour tester directement le RAG :

```bash
curl -s http://localhost:3000/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"Is water infiltration through foundations covered?"}'
```

## Arrêter les services

Arrêter NestJS avec `Ctrl+C`, puis :

```bash
docker compose down
```

**Ne pas utiliser `docker compose down -v`** sauf si vous souhaitez supprimer les volumes PostgreSQL et leurs données.

## Notes

- `db/init.sql` est un script d'initialisation **idempotent**, pas un outil de migration de schéma.
- Les documents d'assurance du projet sont fictifs et réservés à l'apprentissage.
- Les appels aux modèles AWS Bedrock sont facturés selon l'utilisation ; configurer une alerte AWS Budgets est recommandé.


## Architecture comparison: Version A vs Version B

Both versions share the same NestJS process, MCP Claims/CRM stdio servers (started once via `InsuranceMcpService`), RAG embeddings/retriever, and Bedrock Haiku model id from `.env`. They do not share conversation checkpoints or agent loops.

### Version A — autonomous Bedrock agent (`createAgent`)

- **Endpoint:** `POST /agents/bedrock/ask`
- **Body:** `{ "conversationId": "...", "question": "...", "debug": true }` (optional `debug`)
- **Behavior:** LangChain agent chooses MCP and RAG tools per turn; PostgresSaver keeps multi-turn memory.
- **Example:**

```bash
curl -s http://localhost:3000/agents/bedrock/ask \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"demo-001","question":"For claim CLM-001, who is the customer?","debug":true}'
```

### Version B — explicit LangGraph workflow

- **Endpoint:** `POST /workflows/claim-lookup`
- **Body:** `{ "claimId": "CLM-001", "question": "..." }`
- **Behavior:** Fixed graph: MCP claim → MCP customer by `policyId` → RAG retrieval → **one** Haiku completion. Returns `answer`, `sources`, `warnings`, `claim`, `customer`, and `metrics` (duration, LLM/MCP call counts, tokens).
- **No** conversation id and **no** Postgres checkpoint for this workflow.
- **Example:**

```bash
curl -s http://localhost:3000/workflows/claim-lookup \
  -H "Content-Type: application/json" \
  -d '{"claimId":"CLM-001","question":"For claim CLM-001, identify the customer, check the claim status, and explain which policy clauses may apply to the reported water damage."}'
```

Run either endpoint while `npm run start:dev` is up; both can be exercised independently without calling one from the other.

### Version B′ — LangGraph human-in-the-loop (`interrupt()` + `Command({ resume })`)

- **Endpoints:** `POST /workflows/claim-review` then `POST /workflows/claim-review/resume`
- **Behavior:** Same data path as Version B (MCP claim → MCP customer → RAG → **one** Haiku call for a *draft recommendation*), then **`interrupt()`** pauses until an adjuster responds. No claim or payment APIs are called; approve/reject outcomes are **simulated** in graph state only.
- **Persistence:** `PostgresSaver` with `thread_id` values prefixed `claim-review:` (separate from the autonomous agent’s `bedrock:` conversation ids). Restart NestJS between interrupt and resume to prove checkpoints survive.
- **LangGraph note:** The interrupting node only calls `interrupt()` (no MCP/LLM). Recommendation generation runs in the previous node so a resume does not repeat expensive steps when LangGraph re-enters the interrupt node.

**Start (expect `status: "awaiting_approval"` and a `threadId`):**

```bash
curl -s http://localhost:3000/workflows/claim-review \
  -H "Content-Type: application/json" \
  -d '{"claimId":"CLM-001","question":"Review claim CLM-001 and recommend whether it should be approved."}'
```

**Resume — approved:**

```bash
curl -s http://localhost:3000/workflows/claim-review/resume \
  -H "Content-Type: application/json" \
  -d '{"threadId":"<threadId from start>","approved":true,"comment":"Approved by claims adjuster"}'
```

**Resume — rejected:**

```bash
curl -s http://localhost:3000/workflows/claim-review/resume \
  -H "Content-Type: application/json" \
  -d '{"threadId":"<threadId from start>","approved":false,"comment":"Insufficient documentation"}'
```

**Persistence demo:** Stop Nest (`Ctrl+C`), run `npm run start:dev` again, then call **resume** with the same `threadId` (no need to call start again).

| Concept | Role |
|--------|------|
| `interrupt(payload)` | Saves a human task in the checkpoint and stops the run until `Command({ resume })` |
| `PostgresSaver` | Stores channel state + pending interrupt metadata across process restarts |
| `thread_id` | Isolates this workflow run; must not reuse `conversationId` from Version A |
| `Command({ resume })` | Supplies the adjuster decision; resumes inside the interrupt node without restarting from `START` |

### Claim monitoring agent (in-memory LangChain singleton)

- **Endpoint:** `POST /monitoring/claims`
- **Behavior:** A single `createAgent()` instance (Haiku via Bedrock, **no** tools, **no** checkpointer) reuses one `systemPrompt` with business rules. Each request calls `onClaim()` with a **new** `thread_id` so claims do not share conversation history.
- **Output:** Structured JSON (`compliant`, `violations[]`, `summary`) — educational only, not a binding decision.
- **Why no MCP/RAG:** Rules apply to fields in the request body only; no policy PDF search or live claim systems.

**Singleton vs memory:** The Nest service holds the compiled agent in memory. That is not the same as PostgresSaver conversation memory on `/agents/bedrock/ask`. The system prompt is included on every Bedrock call; each claim is a fresh user message.

```bash
curl -s http://localhost:3000/monitoring/claims \
  -H "Content-Type: application/json" \
  -d '{"claimId":"CLM-100","policyId":"POL-001","amount":25000,"currency":"CAD","incidentDate":"2026-11-01","submittedAt":"2026-11-25","description":"Minor water damage"}'
```

**Five sample scenarios** (with `npm run start:dev` running):

```bash
node --env-file=.env scripts/run-monitoring-examples.mjs
```

### Version C — AgentCore Gateway benchmark (Phase 1, separate folder)

Managed MCP over Lambda (not wired into Nest). See [aws/benchmark/README.md](aws/benchmark/README.md). **Do not run `terraform apply` until you explicitly approve deployment.**

## langchain ask example


```
 (Invoke-RestMethod `
   -Uri "http://localhost:3000/agents/langchain/ask" `
   -Method Post `
   -ContentType "application/json; charset=utf-8" `
   -Body '{"conversationId":"test-001","question":"Quel est le statut de la reclamation CLM-001 ?"}'
 ).answer
```
