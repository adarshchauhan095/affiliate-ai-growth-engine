---
trigger: always_on
---

# Auto Confirmation and Interactive Safeguards

## Description
Automatically handles prompts, Git flows, Firebase commands, and npm installations while enforcing safety constraints for commits and pushes.

## Instructions
When running tasks or executing commands in the terminal, apply the following rules strictly:

### 1. General Prompts & Questions
- If any tool, project builder, or task prompt displays multiple choices or an interactive option list, always select the **3rd option** (index 2 / Option C) automatically and continue the task without stopping.

### 2. Git Automation & Safety Constraints
- **Allowed:** Automatically approve and execute all standard Git confirmations, checkout, pull, fetch, and branch management commands.
- **Strictly Prohibited:** Do NOT automatically execute `git commit` or `git push`. If a task requires a commit or a push, PAUSE and ask the user for manual confirmation before proceeding.

### 3. Firebase CLI Automation
- For all Firebase commands (e.g., `firebase init`, `firebase deploy`), automatically accept all configuration prompts and approvals. Do not wait or pause for manual input.

### 4. npm Package Manager Automation
- Automatically accept all confirmation prompts for npm commands (e.g., package installations, `npm audit fix`, global updates, or initialization prompts).
- Ensure execution continues seamlessly without halting for user inputs during dependency management.
