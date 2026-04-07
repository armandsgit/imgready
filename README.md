# AI Background Remover

A production-ready Next.js app that removes image backgrounds using the `briaai/rmbg-1.4` model on Replicate.

## Features

- Drag-and-drop upload with file validation (JPG, JPEG, PNG, WEBP)
- Max upload size: 10MB
- Background removal via Replicate API
- Processing states: idle, uploading, processing, result
- Side-by-side previews and before/after compare slider
- Download optimized transparent PNG output
- Concurrency limit of 3 simultaneous background-removal requests
- Output optimization with Sharp (PNG compression + max width 2000px)

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- TailwindCSS
- React Dropzone
- Framer Motion
- Sharp

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy env file and add your Replicate token:

   ```bash
   cp .env.example .env.local
   ```

3. Add your token in `.env.local`:

   ```env
   REPLICATE_API_TOKEN=your_token_here
   ```

4. Start development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Where can I open the app?

- **Local development:** open [http://localhost:3000](http://localhost:3000) after running `npm run dev`.
- **Production deployment:** deploy to Vercel (or any Node host) and open your deployed URL.

## API

### `POST /api/remove-bg`

Accepts `multipart/form-data` with an `image` field.

Returns optimized transparent PNG binary data.

### Validation

- MIME type must be one of `image/jpeg`, `image/png`, `image/webp`
- File size must be <= 10MB

## Build for Production

```bash
npm run build
npm start
```
