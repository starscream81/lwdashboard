VS Code Git: 5-Line Sticky Note

Start Work

Switch to work (bottom-left branch name)

Pull (refresh icon)

Do Work
3. Stage → Commit (Source Control panel)

Before Leaving
4. Push (cloud ↑)

Ship to Prod
5. On main: pull → merge work → push

==

VS Code Git Cheat Sheet

For main and work branches

1. Before anything else on each PC

Open VS Code in the repo folder:

File → Open Folder → C:\Users\Kevin\projects\lastwar-dashboard

Make sure the Source Control icon on the left shows your repo

2. Start work on a PC

Every time you sit down to work:

Look at the bottom left. Click the branch name (probably main at first)

In the list, choose work
• If work does not show up, choose Checkout to or Fetch, then select work

After you are on work, pull the latest
• Click the circular refresh icon in the bottom bar
• Or press Ctrl+Shift+P and run “Git: Pull”

Now this PC is in sync with GitHub on the work branch.

3. While you are working

When you change files:

Click the Source Control icon on the left

Under “CHANGES”, review the files

Stage files
• Click the plus icon next to each file you want to include
• Or click the plus next to “CHANGES” to stage everything

Type a commit message in the box at the top

Click the checkmark button to commit

This is the same as git add and git commit.

You can commit as often as you like.

4. Before you leave that PC

Always push your work.

Make sure you have committed what you care about

Click the cloud with up arrow icon in the bottom bar
• Or Ctrl+Shift+P → “Git: Push”

That sends the current work branch to GitHub so the other PC can pull it.

5. Start work on the other PC

Repeat the “Start work on a PC” steps:

Open VS Code in the repo folder

Click the branch name in the bottom left and choose work

Click the refresh icon or run “Git: Pull”

You now have exactly the same work code that you pushed from the first PC.

6. When something is ready to ship to main

This is when you want a clean change that is ready for live use.

Simplest version using VS Code plus one or two small commands if needed:

Make sure work has the finished change and is pushed
• On work, commit and push as normal

Switch to main
• Bottom left branch name → choose main

Pull latest main
• Refresh icon or “Git: Pull”

Merge work into main
Easiest is to use the terminal inside VS Code:
• Ctrl+ (backtick) to open terminal
• Run git merge work

If there are conflicts, VS Code will show them and you can click through and fix

When done, commit the merge if Git asks

Push main
• Cloud with up arrow or “Git: Push”

Now main has the finished change and Vercel can deploy it.

7. Quick mental checklist

On any PC when starting

• Switch branch to work in the bottom left
• Pull

While coding

• Source Control panel
• Stage files
• Commit with a message

Before leaving

• Push work

When shipping

• Make sure work is pushed
• Switch to main
• Pull
• Merge work into main using the VS Code terminal
• Push main