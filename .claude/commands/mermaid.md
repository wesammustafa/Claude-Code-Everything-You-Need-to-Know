create a mermaid diagrams that represent all the sql together with their entity relationship. ie an entity relationship diagrams. include the properties of each table in the diagram. 
2 sql files are located in lana/app/migrations/
create a mermaid diagram for each sql files. one lana.md in docs/lana.md, and the other docs/cala.md
make sure the mermaid compile by running `npx -p @mermaid-js/mermaid-cli mmdc -i docs/{lana|cala}.md -o test.md`
when complete, verify that every entity in any .sql migration file appears in the mermaid file
also, you can remove test.md, we just want to use `mmdc` to verify the code generated compiles