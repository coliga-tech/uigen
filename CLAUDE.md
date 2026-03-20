# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies, set up Prisma, and run migrations
npm run setup

# Development server (Turbopack)
npm run dev

# Production build
npm run build && npm run start

# Lint
npm run lint

# Run all tests
npm run test

# Run a single test file
npx vitest run src/components/chat/__tests__/ChatInterface.test.tsx

# Reset database
npm run db:reset
```

## Environment

Copy `.env.example` to `.env` and set:
- `ANTHROPIC_API_KEY` — if omitted, the app falls back to a `MockLanguageModel` for testing without an API key
- JWT secret and other vars as needed

## Architecture

**UIGen** is an AI-powered React component generator with live preview. The user chats with Claude, which generates code into a virtual file system, then the result is previewed in a sandboxed iframe.

### Request Flow

1. User message → `ChatInterface` → `/api/chat` (POST, streaming)
2. Vercel AI SDK streams Claude's response; Claude calls tools (`str_replace_editor`, `file_manager`) to write/edit files
3. Tool results update the **virtual file system** (in-memory, `FileSystemProvider`)
4. Preview panel re-renders: Babel transforms JSX/TS → JS, an import map resolves npm packages via `esm.sh`, and a dynamic `<iframe>` displays the result with Tailwind CSS via CDN

### Key Modules

| Path | Purpose |
|---|---|
| `src/app/api/chat/route.ts` | Streaming AI endpoint; wires up tools and model |
| `src/lib/provider.ts` | Returns real Anthropic model or `MockLanguageModel` |
| `src/lib/file-system.ts` | In-memory `Map`-based virtual file system |
| `src/lib/transform/jsx-transformer.ts` | Babel JSX → JS + import map generation |
| `src/lib/tools/` | Tool definitions (`str_replace_editor`, `file_manager`) |
| `src/lib/prompts/` | System prompts sent to Claude |
| `src/lib/auth.ts` | JWT creation/verification (jose + bcrypt) |
| `src/app/main-content.tsx` | 3-panel resizable layout (chat | preview | code editor) |
| `src/lib/contexts/` | `FileSystemProvider`, `ChatProvider` React contexts |
| `src/actions/` | Server actions for auth and project CRUD |

### Database

SQLite via Prisma. Two models:
- `User` — email/password (bcrypt)
- `Project` — stores serialized virtual file system (`data` JSON) and conversation history (`messages` JSON)

Schema: `prisma/schema.prisma`

### Authentication

JWT stored in an HTTP-only cookie (7-day expiry). Middleware at `src/middleware.ts` protects routes. Anonymous users can use the app without signing in; projects are only persisted for authenticated users.

### Testing

Tests live in `__tests__` directories co-located with source. Uses Vitest + React Testing Library + jsdom. The `MockLanguageModel` in `src/lib/provider.ts` is what tests use to avoid real API calls.
