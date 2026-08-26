# Aleem & Nurulain - Our Flight frontend

This folder is the standalone, static GitHub Pages frontend. It contains no invitation-class links, passcode material, signing secrets, spreadsheet details, or private itinerary scope. All invitation content is returned by the private API after check-in.

Use Node.js 22.13 or later for local development and CI.

## Local development

1. Copy `.env.example` to `.env.local` and set `VITE_API_ORIGIN` to the backend origin. The built-in local fallback is `http://localhost:3000`.
2. Run `npm ci`.
3. Run `npm run dev`.
4. Open the complete private hash link supplied by the backend.

## GitHub Pages

Publish the contents of this folder as the root of its own repository. In that repository:

1. Add a repository variable named `API_ORIGIN` containing the exact Sites API origin, without a trailing path.
2. In **Settings > Pages**, select **GitHub Actions** as the source.
3. Push to `main` or run the workflow manually.

The workflow uses Node 22, verifies lint and tests, creates the Vite build, scans the artifact for private literals and size regressions, then deploys Pages. The base path is calculated from the GitHub repository name, so project Pages URLs work without manual asset-path changes.

Invitation links use the format `https://OWNER.github.io/REPOSITORY/#/i/OPAQUE_TOKEN`. Because the token is in the URL fragment, it is not included in the request GitHub Pages receives.

## Commands

- `npm run dev` - local Vite development server
- `npm run lint` - static analysis
- `npm test` - unit tests
- `npm run build` - production build
- `npm run check:artifact` - privacy and performance-budget scan
