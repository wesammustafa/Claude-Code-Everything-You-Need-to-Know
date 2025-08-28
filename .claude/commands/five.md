# Five Whys Analysis

Apply the Five Whys root cause analysis technique to investigate issues.

## Description
This command implements the Five Whys problem-solving methodology, iteratively asking "why" to drill down from symptoms to root causes. It helps identify the fundamental reason behind a problem rather than just addressing surface-level symptoms.

## Usage
`five [issue_description]`

## Variables
- ISSUE: The problem or symptom to analyze (default: prompt for input)
- DEPTH: Number of "why" iterations (default: 5, can be adjusted)

## Steps
1. Start with the problem statement
2. Ask "Why did this happen?" and document the answer
3. For each answer, ask "Why?" again
4. Continue for at least 5 iterations or until root cause is found
5. Validate the root cause by working backwards
6. Propose solutions that address the root cause

## Examples
### Example 1: Application crash analysis
```
Problem: Application crashes on startup
Why 1: Database connection fails
Why 2: Connection string is invalid
Why 3: Environment variable not set
Why 4: Deployment script missing env setup
Why 5: Documentation didn't specify env requirements
Root Cause: Missing deployment documentation
```

### Example 2: Performance issue investigation
Systematically trace why a feature is running slowly by examining each contributing factor.

## Notes
- Don't stop at symptoms; keep digging for systemic issues
- Multiple root causes may exist - explore different branches
- Document each "why" for future reference
- Consider both technical and process-related causes
- The magic isn't in exactly 5 whys - stop when you reach the true root cause