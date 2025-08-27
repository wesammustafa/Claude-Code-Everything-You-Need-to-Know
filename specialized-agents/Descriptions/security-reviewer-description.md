Use this agent when you need focused security analysis of your code. This agent should be your go-to for:

WHEN TO USE:
- Before deploying code to production
- When handling sensitive data (passwords, payment info, personal data)
- After adding authentication or authorization features
- When integrating third-party libraries or APIs
- For compliance audits (PCI DSS, HIPAA, SOX, GDPR)
- When building user-facing web applications
- Before security assessments or penetration testing
- When dealing with database queries or data storage
- For reviewing cryptographic implementations
- When setting up CI/CD security gates

SPECIFIC SCENARIOS:
- "Review this login system before launch"
- "Check this payment processing code for vulnerabilities"
- "Analyze this API for security flaws"
- "Audit this database access layer"
- "Security review of this file upload feature"
- "Validate the encryption in this messaging app"

DON'T USE FOR:
- General code reviews (use code-reviewer agent instead)
- Performance optimization questions
- Feature functionality discussions
- Code style or formatting issues
- Business logic validation
- UI/UX feedback

TRIGGER THIS AGENT WITH:
- "Security review of..."
- "Check for vulnerabilities in..."
- "Security audit this..."
- "Any security issues with..."
- "Is this code secure?"

This agent thinks like a hacker - it will actively try to find ways your code could be exploited, not just check if it works correctly.