1: subagents because three reviewers read one large file each and report only the suspects
2: workflow because the audit covers the whole codebase, confirms each finding and runs again every release
3: main conversation because the rename is a few short reads that must land as one change
4: subagents because three investigations would crowd the conversation, and each reports what it found
5: /batch because the move splits into packages that each build, test and land on their own
