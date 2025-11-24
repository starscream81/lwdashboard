This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

🚀 Git Workflow Guide (Home + Work PC)

This project uses a simple, safe branching model so work-in-progress stays separate from production.

📌 Branches

main
Stable, production-ready code. Only merge into this when a feature is complete and tested.

work
Active development branch. All in-progress features live here until they are cleaned up or split into feature branches.

🔄 Daily Workflow
👉 When you sit down at either computer

Open Git Bash inside the project folder:

cd /c/Users/Kevin/projects/lastwar-dashboard
git switch work
git pull origin work


This syncs the machine to the latest work-in-progress code.

👉 While you're working

Commit small logical chunks often:

git add .
git commit -m "WIP: description of what you did"

👉 Before leaving the computer

Always push your updates so the other machine can pull them:

git push origin work


This keeps both your machines synchronized and avoids conflicts.

🌿 Feature Cleanup (optional, when a feature is nearly ready)

Sometimes one task becomes ready before the rest.
When a feature from the work branch is close to complete, create a dedicated feature branch:

git switch work
git pull origin work
git switch -c feature/<name>


Clean up or isolate just the relevant changes, then:

git add .
git commit -m "Finish <name>"
git push -u origin feature/<name>


Then merge it into main:

git switch main
git pull origin main
git merge feature/<name>
git push origin main

🌐 Multi-Machine Workflow Summary

Home PC → Work PC → Home PC

Always follow this pattern:

Before leaving:
git add .
git commit -m "WIP"
git push origin work

When arriving:
git switch work
git pull origin work

This guarantees both computers always see the same code and nothing gets lost.

🔒 Secrets

These files must never be committed:

.env.local

any .env files

service account JSON

API keys

Firebase credentials

Make sure your .gitignore includes:

.env
.env.local
.env.*
*service-account*.json
*.credentials.json

🧹 If the repo gets stuck in a rebase/merge

Run:

git rebase --abort || true
git merge --abort || true
git rebase --quit || true


Then continue normally.

✔️ This workflow prevents:

broken rebases

diverged branches

losing work between home/work computers

OneDrive replacing your Git history

committing secrets by accident





You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
