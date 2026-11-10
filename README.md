This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, Install all dependencies;

```bash
pnpm install

```

then, run the development server:

```bash

pnpm dev

```

or

```
pnpm run dev

```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing Konneqta Teams locally

When both apps are running locally, keep Konneqta on port `3000` and start the
Teams app from its repository on port `3001`:

```bash
pnpm dev --port 3001
```

In Konneqta's ignored `.env.local`, set:

```env
NEXT_PUBLIC_TEAMS_APP_URL=http://localhost:3001
```

Restart Konneqta after changing `.env.local`. The homepage and signup links will
then open the local Teams signup page. If this variable is unset, the links
continue to use `https://teams.konneqta.com/teams/signup`, including in
production.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
