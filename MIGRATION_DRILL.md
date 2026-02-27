# Subapp Migration Drill

This drill validates that each sub-application can be migrated out of the current monorepo with minimal coupling to the host repository.

## Goals

- Verify standalone build and type-check for a copied subapp
- Verify i18n and styles are package-local
- Verify runtime adapter fallback works without host runtime

## Scope

- `packages/image-studio`
- `packages/investment`

## Prerequisites

- Node.js 23+
- npm 10+
- macOS/Linux shell

## Drill Steps

### 1) Create a temporary extraction workspace

```bash
rm -rf /tmp/ai-image-migration-drill
mkdir -p /tmp/ai-image-migration-drill
```

### 2) Copy a subapp package only

Image Studio:

```bash
cp -R packages/image-studio /tmp/ai-image-migration-drill/image-studio
```

Investment:

```bash
cp -R packages/investment /tmp/ai-image-migration-drill/investment
```

### 3) Install dependencies in extracted package

Image Studio:

```bash
cd /tmp/ai-image-migration-drill/image-studio
npm install
```

Investment:

```bash
cd /tmp/ai-image-migration-drill/investment
npm install
```

### 4) Run standalone checks

Image Studio:

```bash
npm run type-check
npm run build
npm run dev
```

Investment:

```bash
npm run type-check
npm run build
npm run dev
```

### 5) Validate expected isolation behavior

- Entry point resolves from package-local `src/entry.tsx`
- Tailwind styles resolve from package-local `src/styles/index.css`
- i18n resources resolve from package-local `src/i18n/locales/*`
- No imports resolve to host-only paths
- Investment runtime adapter works without `window.hostKernelRuntime`

## Pass/Fail Criteria

Pass:

- All standalone checks succeed without monorepo root files
- App can run locally with `npm run dev`
- No runtime crash from missing host bridge

Fail:

- Build depends on root alias/config not present in extracted package
- Runtime requires host-only globals without fallback

## Follow-up Actions

If drill fails:

1. Record failing import path or missing config
2. Move dependency into package-local config/resource
3. Re-run this drill until pass
