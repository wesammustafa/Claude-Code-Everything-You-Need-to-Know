# ✅ LLM Unit Testing Best Practices Checklist  
_Focused on testing internal logic, not API endpoints_

---

## 🔍 Context Verification

- [ ] **Understand the Purpose of the Component**  
  Do not infer from names. Derive intent from behavior and direct usage.

- [ ] **Identify Critical Inputs and Outputs**  
  Cover expected, edge, malformed, and unexpected scenarios.

- [ ] **Determine the True Unit Under Test**  
  Target the logic layer (e.g., services, classes, helpers)—**not** API routes or request handlers.

- [ ] **Avoid API Testing Patterns**  
  Do **not** simulate `NextRequest`, `fetch`, or `Express` routes unless explicitly instructed.

- [ ] **Apply Strict Scope Discipline**  
  Don’t touch other modules, files, or features unless clearly necessary.

- [ ] **Always Tend to Simplify**  
  Clear, modular tests beat overly clever ones.

- [ ] **Avoid Adding Dependencies Unless Justified**  
  Don't install libraries unless there's a **strong, test-specific** reason.

- [ ] **Preserve Test Configuration**  
  Do not alter global setups, environments, or shared mocks unless explicitly asked.

- [ ] **Use Subagents for Complex Flows**  
  When testing decision trees or workflows, spawn helpers to aid decomposition and reliability.

---

## ⚙️ Test Structure

- [ ] **Test Core Behavior, Not Wiring**  
  The unit under test must not include route handlers, HTTP abstractions, or serialization logic.

- [ ] **Follow the Given–When–Then Format**  
  Reinforces clarity and intention behind test actions.

- [ ] **Name Tests Clearly**  
  Prefer: `should_<action>_when_<condition>_given_<context>`

---

## 🧪 Test Cases

- [ ] **Focus on Internal Logic Units**  
  Classes, methods, services, pure functions—these are the test targets.

- [ ] **Cover Valid and Invalid Inputs**  
  Ensure the unit responds correctly to correct and incorrect usage.

- [ ] **Avoid Over-Mocking**  
  Only mock **I/O or external services**—never mock the unit’s own logic.

- [ ] **Don’t Test API Response Codes or Routing Behavior**  
  This is not the place for `POST(req)` or handler-level simulation.

- [ ] **Test Error Handling at Logic Level**  
  Use exceptions or return contracts to test failure modes.

- [ ] **Ensure Side Effects Are Observable**  
  Mock or spy on dependencies like loggers, DBs, and queues.

- [ ] **Concurrency or Timing Logic?**  
  Test resolution order, error propagation, and safe retries where applicable.

---

## 🧼 Cleanliness & Isolation

- [ ] **Mock All I/O**  
  DBs, APIs, file systems, message queues—never call real ones.

- [ ] **Keep Internal Logic Real**  
  Do not mock:  
  - Business rules  
  - Validation logic  
  - Pure functions or deterministic workflows

- [ ] **No Magic Values**  
  Prefer named constants or well-described literals.

- [ ] **Clean Test State Between Runs**  
  All tests must be deterministic, stateless, and safe for parallel execution.

- [ ] **No Real HTTP or Framework Bindings**  
  No `fetch`, no `NextRequest`, no server context.

---

## 🧠 Deep Assertions

- [ ] **Check Real Output Contracts**  
  Assert on return values, thrown errors, and logged events.

- [ ] **Test for Type and Shape**  
  Use TS-aware assertions to verify runtime matches compile-time contracts.

- [ ] **Guard Against Silent Changes**  
  Test behavior boundaries, not just return values.

---

## 📦 Maintainability

- [ ] **Avoid Duplicated Test Code**  
  Use factories, builders, and setup helpers.

- [ ] **Mock via Public Interfaces**  
  Never mock private internals—only what the consumer sees.

- [ ] **Don’t Lock In Behavior That Can Change Safely**  
  Test business outcomes, not private steps (unless debugging a regression).

---

## 📣 Final Prompt Guidance for the LLM

> You are writing a **unit test** for `$FEATURE`, focusing exclusively on internal logic (e.g., services, helpers, pure functions).  
>
> 🔒 You **must not** simulate API requests, handlers, routers, or HTTP layers.  
> 🔍 Test business logic, validation rules, branching paths, and error cases.  
> ✅ Ensure all assertions are observable, meaningful, and test contracts, not internals.  
> 🧪 Prefer clean test design over full coverage. Quality > quantity.  
>
> Always run `npm run build` and `npm test` to confirm test correctness and build integrity.  
> Be precise, focused, and insightful. Your job is to ensure the logic is future-proof.
> Ultrathink.
> Alway Span 4 sub-agents at least to help you accelerate the work completion.
