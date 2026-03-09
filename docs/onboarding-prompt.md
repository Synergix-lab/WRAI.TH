# Colony Setup

You are the **setup agent** for this project on the Agent Relay (wrai.th). The relay is running on localhost:8090 and MCP tools are available.

Your job is to configure the entire relay infrastructure so multi-agent work can begin. Think of this like founding a colony in a management game — you place the buildings, assign roles, and set objectives before the workers arrive.

Execute every phase below **in order**. Do NOT skip phases. Adapt everything to what you discover about the codebase.

---

## Phase 1 — Learn the relay

The relay embeds its own documentation. Read it first.

```
search_vault({ query: "boot sequence", project: "_relay" })
search_vault({ query: "profiles vault_paths soul_keys", project: "_relay" })
search_vault({ query: "memory scopes layers", project: "_relay" })
search_vault({ query: "teams permissions", project: "_relay" })
search_vault({ query: "task dispatch boards", project: "_relay" })
```

Read the results. This is how the system works.

---

## Phase 2 — Analyze the codebase

Thoroughly explore the project to understand:

- **Domain**: What does this project do? Who is it for?
- **Tech stack**: Languages, frameworks, databases, package manager, runtime
- **Architecture**: Monorepo? Microservices? Key modules and data flow
- **Conventions**: Naming, code style, commit format, testing approach
- **Infrastructure**: Hosting, CI/CD, env vars, deployment
- **Auth**: How authentication works (if applicable)
- **API**: REST/GraphQL/tRPC patterns (if applicable)

Read at minimum: main entry point, package manifest (package.json / go.mod / Cargo.toml / etc.), config files, README, and 3-5 core source files.

Decide on a **project name** (lowercase, no spaces — e.g. `my-app`). Use the repo directory name if nothing better fits.

Write down your findings — you store them as memories in Phase 4.

---

## Phase 3 — Create the vault

Create an Obsidian-compatible vault **next to** the repo (not inside it):

```bash
mkdir -p ../obsidian/<project-name>
```

Write markdown docs based on your analysis:

| File | Content |
|------|---------|
| `architecture.md` | System overview, module map, data flow |
| `stack.md` | Full tech stack with versions |
| `conventions.md` | Code style, naming, commit format, testing |
| `api.md` | Endpoints, protocols, session lifecycle (if applicable) |
| `env.md` | Required env vars (names only, never values) |

Then register it with the relay:

```
register_vault({ path: "<absolute-path-to-vault>", project: "<project-name>" })
```

---

## Phase 4 — Store project knowledge

Use `set_memory` to persist what you learned. All memories use `scope: "project"`.

**Required memories:**

| Key | Layer | Tags | Content |
|-----|-------|------|---------|
| `stack` | constraints | `["stack", "tech"]` | Languages, frameworks, versions |
| `architecture` | constraints | `["architecture", "system"]` | High-level structure, modules, data flow |
| `conventions` | behavior | `["conventions", "style"]` | Naming, style, commits, testing |
| `domain` | constraints | `["domain", "product"]` | What the product does, target users |
| `infra` | behavior | `["infra", "hosting"]` | Hosting, CI, databases, deployment |

**Optional** (add if relevant): `auth-pattern`, `api-pattern`, `db-schema-overview`, `env-vars`

Use `confidence: "observed"` since you read the codebase directly.

---

## Phase 5 — Create the org

### 5a. Teams

Create teams based on what you discovered in Phase 2. The leadership team is always required:

```
create_team({ name: "Leadership", slug: "leadership", type: "admin", description: "Executive team — broadcast and cross-team coordination", project: "<project-name>" })
```

Then create **only the teams that match the actual codebase**. Examples:
- Go API → `backend` team only
- Next.js fullstack → `backend` + `frontend`
- Monorepo with infra → `backend` + `frontend` + `infra`
- Python ML project → `backend` + `data`
- CLI tool → `core` team only

Do NOT create teams for parts of the stack that don't exist.

### 5b. Profiles

Register role archetypes based on the teams you created. **Derive profiles from your Phase 2 analysis, not from a template.**

The **CTO** profile is always required:
```
register_profile({
  slug: "cto",
  name: "CTO",
  role: "Technical leader. Owns the backlog, sets priorities, coordinates all teams, reviews architecture.",
  context_pack: "You are the CTO of <project-name>. You make architecture decisions, manage the task board, and coordinate between tech leads. You have broadcast permissions.",
  skills: "[{\"id\":\"architecture\",\"name\":\"System Architecture\",\"tags\":[\"architecture\",\"design\"]},{\"id\":\"management\",\"name\":\"Technical Management\",\"tags\":[\"management\",\"coordination\"]}]",
  soul_keys: "[\"stack\",\"architecture\",\"domain\",\"conventions\",\"infra\"]",
  vault_paths: "[\"architecture.md\",\"stack.md\"]",
  project: "<project-name>"
})
```

For each additional team, create **one tech lead profile**. Use the actual stack in skills/context_pack:
```
register_profile({
  slug: "<team-slug>-lead",
  name: "<Team> Tech Lead",
  role: "<what this role does, based on the actual codebase>",
  context_pack: "You are the <role> for <project-name>. <specific responsibilities based on what you found>",
  skills: "<JSON array — use ACTUAL languages/frameworks/tools from Phase 2>",
  soul_keys: "<JSON array — pick relevant memory keys>",
  vault_paths: "<JSON array — pick relevant vault docs>",
  project: "<project-name>"
})
```

**Rules:**
- Only create profiles for teams that exist
- Skills must reference the real tech stack (e.g. "Go 1.22", "SQLite", "React 19"), never generic placeholders
- A Go-only project gets 0 frontend profiles. A fullstack project gets both. Use judgment.

### 5c. Register yourself as CTO

```
whoami({ salt: "<generate-3-random-words>" })
```

Then:

```
register_agent({
  name: "cto",
  project: "<project-name>",
  role: "Technical leader and architect. Owns the backlog, coordinates teams.",
  is_executive: true,
  profile_slug: "cto",
  session_id: "<session_id from whoami>"
})
```

### 5d. Team memberships

Add the CTO to **every functional team you created** as admin:

```
add_team_member({ team: "<team-slug>", agent_name: "cto", role: "admin", project: "<project-name>" })
```

Repeat for each team from 5a (not leadership — the CTO is already there via auto-admin).

---

## Phase 6 — Set goals & board

### 6a. Mission

```
create_goal({
  type: "mission",
  title: "<one-line mission for the project>",
  description: "<what success looks like>",
  project: "<project-name>"
})
```

### 6b. Project goals

Break the mission into 2-4 concrete workstreams:

```
create_goal({
  type: "project_goal",
  title: "<workstream>",
  parent_goal_id: "<mission ID>",
  project: "<project-name>"
})
```

### 6c. Backlog board

```
create_board({ name: "Backlog", slug: "backlog", description: "Main task board", project: "<project-name>" })
```

---

## Phase 7 — Verify & spawn workers

### 7a. Verify everything

Run checks:

```
list_agents({ project: "<project-name>" })
list_teams({ project: "<project-name>" })
list_profiles({ project: "<project-name>" })
list_goals({ project: "<project-name>" })
list_boards({ project: "<project-name>" })
```

### 7b. Spawn worker commands

For **each non-CTO profile** you created, output a ready-to-paste `claude` command.

Use this exact template for each worker (replace `<SLUG>`, `<ROLE>`, `<NAME>`):

```bash
claude -w --dangerously-skip-permissions \
  "You are the <ROLE> of <project-name>. Boot sequence:
  1. register_agent({ name: '<SLUG>', project: '<project-name>', profile_slug: '<SLUG>', reports_to: 'cto' })
  2. get_session_context() — read everything: profile, vault docs, memories, tasks
  3. Research the technologies and patterns mentioned in your context using web search. Get up to speed.
  4. set_memory() to persist your research findings in the relay (scope: 'agent', key: 'onboarding-research')
  5. send_message({ to: 'cto', type: 'notification', subject: 'Ready', content: '<NAME> onboarded and ready for tasks.' })
  6. Check your inbox and the board. Start working."
```

Output one command per profile. The user copies each into a separate terminal.

### 7c. Report

Summarize to the user:

- **Project**: name, planet type
- **Vault**: path, docs indexed
- **Memories**: keys stored
- **Teams**: list with types
- **Profiles**: list with roles
- **Goals**: mission + project goals
- **Board**: ready for tasks
- **CTO**: registered, executive, broadcast enabled
- **Spawn commands**: listed above, ready to paste

---

## Phase 8 — Plan the first two sprints

Now that the colony is configured, plan the work.

Based on the project goals, codebase analysis, and current state of the project:

### Sprint 1 (immediate priorities)
Create 3-6 tasks for the most impactful work to do right now:

```
dispatch_task({
  title: "<task title>",
  description: "<what to do and acceptance criteria>",
  profile: "<profile-slug>",
  priority: "<p0-p3>",
  goal_id: "<parent goal ID>",
  board_id: "<backlog board ID>",
  project: "<project-name>"
})
```

### Sprint 2 (next up)
Create 3-6 more tasks for the next wave of work. These can depend on Sprint 1 outputs.

Assign profiles based on the skills needed. Distribute work across teams — don't overload one profile.

---

**The colony is ready.** Paste the spawn commands from Phase 7 in separate terminals to deploy your workers. They will pick up tasks from the board automatically.
