# Clean-room install smoke for wrai.th / agent-relay (Linux / x86_64).
#
# Proves the documented one-command install lands the binary + the public Claude
# Code skill + the activity hooks with ZERO errors on a bare image, and that
# re-running is idempotent. This is the Linux clean-install signal that catches
# "skills/hooks didn't land / install errored" — most of the 3h-to-run pain
# (TSU-223 / the TSU-224 suite contract).
#
#   docker build -f install-smoke/wraith.Dockerfile -t wraith-install-smoke .
#
# A successful build == the gate is green. CI: build on every release tag; a red
# install BLOCKS the release.
#
# Note: the installer downloads the prebuilt release binary, so the public skill
# (`agent-relay skill install`) lands only once a release ships that subcommand —
# this gate goes green on the first release carrying it (same release-gated shape
# as dokan's). The relay's runtime service needs systemd, which a bare build
# container lacks; `--no-service` keeps the install to "binary + skill + hooks"
# (the install-time artifacts this contract asserts). The service-up + health
# path is covered separately.
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive HOME=/root

# Documented prereqs only, plus curl + CA certs to fetch. No Go toolchain → the
# installer takes the prebuilt-download path (the realistic end-user path). jq +
# python3 are the installer's documented deps (hook + .mcp.json handling).
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates jq python3 \
 && rm -rf /var/lib/apt/lists/*

# Run the install from THIS repo's installer (so the gate tests the current
# install.sh). --no-service: no systemd in a build container; the contract
# asserts the install-time artifacts (CLI / skill / hooks), not a running relay.
COPY install.sh /opt/wraith/install.sh
COPY install-smoke/assert.sh /assert.sh
RUN bash /opt/wraith/install.sh --no-service --skip-projects

# Idempotency: a second run must not error or clobber.
RUN bash /opt/wraith/install.sh --no-service --skip-projects

# Shared assert contract (TSU-224). wrai.th ships activity hooks, so HOOKS_* are
# set: settings.json must reference the relay's stop hook.
ENV PATH="/root/.local/bin:${PATH}"
RUN TOOL=wraith TOOL_BIN=agent-relay \
    SKILL_FILE=/root/.claude/skills/agent-relay/SKILL.md \
    HOOKS_FILE=/root/.claude/settings.json HOOKS_GREP=ingest-stop.sh \
    sh /assert.sh \
 && echo "INSTALL-SMOKE OK"
