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


## langchain ask example


```
 (Invoke-RestMethod `
   -Uri "http://localhost:3000/agents/langchain/ask" `
   -Method Post `
   -ContentType "application/json; charset=utf-8" `
   -Body '{"conversationId":"test-001","question":"Quel est le statut de la reclamation CLM-001 ?"}'
 ).answer
```
