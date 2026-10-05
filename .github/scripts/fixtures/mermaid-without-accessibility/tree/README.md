# Fixture

The hook blocks the edit when it exits 2.

```mermaid
flowchart LR
  A[Edit] --> B{Hook}
  B -->|exit 0| C[Allowed]
  B -->|exit 2| D[Blocked]
```
