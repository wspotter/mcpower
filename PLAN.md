# Knowledge MCP Server – Step-by-Step Blueprint

## 0. Preconditions
- Machine has Node.js 18+ and Python 3.10+ available on PATH.
- `faiss-cpu`, `sentence-transformers`, `fastapi`, `uvicorn`, and `rich` already installed in the Cherry Studio virtualenv (`/home/stacy/cherry-studio/.venv`).
- Documentation embeddings generated via `scripts/knowledge/build_docs_embeddings.py` or ready to generate.

---

## 1. Repository Setup
1. `cd /home/stacy/mcpower`
2. Run `npm init -y` (or `yarn init -y`).
3. Install base dependencies:
   ```bash
   npm install --save @modelcontextprotocol/sdk zod pino dotenv
   npm install --save-dev typescript tsx @types/node vitest
   ```
4. Add project scaffolding:
   - `tsconfig.json` (moduleResolution node16, outDir `dist`).
   - `.editorconfig`, `.gitignore` (ignore `dist`, `.env`, `datasets/**/docs.index`).
   - `src/` directory with placeholder files.

---

## 2. Dataset Registry Contract
1. Create `datasets/` folder. Each dataset gets a JSON manifest:
   ```json
   {
     "id": "cherry-docs",
     "name": "Cherry Studio Documentation",
     "description": "Embeddings built from the Cherry Studio docs repo",
     "index": "./datasets/cherry-docs/docs.index",
     "metadata": "./datasets/cherry-docs/metadata.json",
     "defaultTopK": 5
   }
   ```
2. Add README snippet describing manifest fields (id, name, description, index, metadata, defaultTopK).
3. Provide helper script `bin/add-dataset.ts` that copies an index folder into `datasets/<id>/` and writes the manifest.

---

## 3. Knowledge Store (TypeScript layer)
1. Recreate `KnowledgeStore` in TypeScript (`src/store/knowledgeStore.ts`). Responsibilities:
   - Verify `docs.index` + `metadata.json` exist.
   - Lazy-load embeddings via Python bridge (call existing Cherry `store.py` or a new `python/bridge.py`).
   - Expose `search(query, topK)` returning hits `{ score, title, path, snippet }`.
2. Python bridge option:
   - Create `python/bridge.py` using Typer/Click.
   - Command: `python bridge.py search --index <dir> --query "..." --k 5` -> prints JSON.
   - Reuse existing `KnowledgeStore` Python class to avoid reimplementing FAISS.
3. In TS, use `execa` or `child_process.spawn` to call the bridge, parse JSON, handle errors, and cache `KnowledgeStore` instances per dataset ID.

---

## 4. MCP Server Implementation
1. Entry file `src/server.ts`:
   - Load `.env` (for overrides such as `KNOWLEDGE_DATASETS_DIR`).
   - Read all manifests under `datasets/` into a map.
   - Instantiate MCP `Server` with name `knowledge-hub` and version from `package.json`.
2. Register tools:
   - `knowledge.listDatasets`: returns array of dataset metadata.
   - `knowledge.search`: input schema `{ dataset: string; query: string; k?: number }`; output top hits with snippet and attribution.
   - Optional `knowledge.reload`: evicts cached store for a dataset and reloads manifest (helpful after embedding rebuild).
3. Add health logging and error handling using `pino` logger.
4. Export `startServer()` function for CLI + tests.

---

## 5. CLI Wrapper & Scripts
1. `src/cli.ts`:
   - Parse flags (`--datasets ./datasets`, `--stdio`, `--host`, `--port`).
   - Launch the MCP server over stdio (default) or HTTP for testing.
2. Add npm scripts:
   ```json
   {
     "scripts": {
       "dev": "tsx src/cli.ts",
       "build": "tsc --project tsconfig.json",
       "start": "node dist/cli.js",
       "test": "vitest",
       "lint": "tsc --noEmit"
     }
   }
   ```
3. Provide `bin/mcpower` (Node shebang) that forwards to compiled CLI (`dist/cli.js`).

---

## 6. Testing Strategy
1. Use `vitest` to cover tool handlers:
   - Mock dataset map and `KnowledgeStore.search` to test input validation and error paths.
   - Ensure `knowledge.search` rejects unknown dataset IDs and empty queries.
2. Add integration test that spins up the server with a fixture dataset (tiny metadata/index stub) and performs a search via MCP client stub.
3. Optionally script `npm run test:e2e` to call CLI using `node dist/cli.js --datasets fixtures --stdio` with a simple JSON request.

---

## 7. Documentation
1. Update repository `README.md`:
   - Explain purpose, features, and MCP tool contracts.
   - Provide quickstart (clone → install → copy embeddings → run `npm run dev`).
   - Include table describing manifest fields and CLI options.
2. Add `docs/USAGE.md` with copy-paste commands:
   - Build embeddings from Cherry repo.
   - Drop them into `datasets/cherry-docs/`.
   - Run `/csknow` style Copilot command referencing the MCP server.
3. Document how to add new datasets (TTS docs, OpenWebUI docs): run embedding builder, create manifest, restart server.

---

## 8. Distribution Checklist
- `npm run build` succeeds.
- `npm run test` passes.
- `dist/` contains CLI and server files.
- Create GitHub release instructions (tag v0.1.0).
- Provide optional Dockerfile:
  ```Dockerfile
  FROM node:20-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci --omit=dev
  COPY dist ./dist
  COPY datasets ./datasets
  CMD ["node", "dist/cli.js"]
  ```

---

## 9. Integration Notes
- VS Code / Copilot: add custom command `/csknow` that shells out to `mcpower` CLI, grabs prompt context, and answers with dataset hits.
- Cherry Studio: configure new MCP provider pointing to the server’s stdio binary; reuse existing knowledge UI to display results.
- Ollama wrapper: call `mcpower --stdio` to fetch top-k snippets before invoking `ollama run`.

