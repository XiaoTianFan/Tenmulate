# Tenmulate

First-person tennis rehearsal in your browser: visualize incoming balls, practice
return timing, and build tactical drills from player shots, opponent returns and
camera movements. Built with React, TypeScript, Vite and Three.js.

**[Open Tenmulate](https://tenmulate.xiaotianfanx.com)**

## Features

- Rally, Return, Volley and Overhead quick practice.
- A drill editor with reusable shots, editable landing zones and camera transitions.
- Complete-drill repetitions with configurable recovery breaks.
- Six authored court environments, an articulated opponent and deterministic ball physics.
- English and Simplified Chinese, selected from your browser language or the language selector.
- Browser-local saves and offline caching after assets have loaded.

Built-in drills, shots, camera positions and perspectives are bilingual. Your own
names, descriptions and cues remain in the language you wrote them.
See the [user guide](docs/user-guide.md) for controls and practice behavior.

## Run locally

Use **Node.js 24.x** and npm. No API keys, database, Blender installation or sibling
motion project are required to run or build the frontend; delivery assets are tracked.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4173/`. For verification and production output:

```sh
npm run check:release
npm run preview
```

`check:release` runs the tests, TypeScript checks, Vite build and active motion/cache
validation. The static output is `dist/`. Blender sources and asset-production tools
are optional; see the [motion contract](docs/development/local-motion-pipeline.md).

## Saving and privacy

**Save drill**, **Save shot**, **Save config** and **Save preset** choose between
project defaults and this browser in local development. Deployed builds save only
to this browser's localStorage. There is no account sync or cloud database. Clearing
site data removes local saves; export important drills before clearing it.

Development project writes use local Vite middleware. That middleware is not
available in a production build. The language preference and editor draft recovery
are browser-local. See the [saving contract](docs/development/saving-system.md).

## GitHub and Vercel

The repository includes GitHub Actions release checks and a Vercel Vite configuration
using Node 24, `npm ci`, `npm run build`, and `dist`. Import the repository into a
new Vercel project; no environment variables are required. CLI uploads exclude local
tools, temporary evidence and Blender source files while retaining runtime assets.

[Release runbook](docs/development/release.md) records the live project, deployment
checks, rollback procedure and remaining device/technique acceptance gates.

## Limits and asset provenance

This is a visualization and shadow-swing tool, not motion tracking or a validated
biomechanics coach. Use a cleared practice area. iOS Screen Mirroring requires
Control Center; the website cannot establish or verify the receiver connection.

Third-party model/material notices and authored asset provenance are listed in
[asset attribution](docs/asset-attribution.md). No repository-wide open-source
license has been selected. Included third-party assets retain their own licenses.

## Project documentation

- [Documentation index](docs/README.md)
- [Current implementation status](docs/development/implementation-status.md)
- [Technical architecture](docs/technical-architecture.md)
- [Internationalization](docs/development/internationalization.md)
- [Contributor/agent instructions](AGENTS.md)
