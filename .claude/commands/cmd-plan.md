Produce a written implementation plan before writing any code. The plan must be specific enough that a different developer could implement it without asking questions.

## Plan structure

### 1. Summary

One or two sentences stating what this task does and why.

### 2. Files

List every file being created or modified with a one-line description of the change.

### 3. Implementation steps

Numbered list of steps in execution order. Each step must:

- Name the specific function, type, or module being worked on
- State what it does, not how to write it
- Call out any non-obvious decisions or tradeoffs

### 4. Data flow

If this task involves data moving between layers (runner -> audit -> report, or CLI -> audit -> MCP), describe the flow explicitly. Name the types at each boundary.

### 5. Error cases

List every expected failure mode and how it is handled:

- What error class is thrown or returned
- What the user-facing message is
- What the exit code is (for CLI paths)

### 6. Test plan

List the test cases that will be written:

- One line per test case
- Cover happy path and every error case listed above
- Name the fixture file if one is needed

### 7. Open questions

List anything that needs a decision before implementation can start. Do not proceed past this point if there are unresolved open questions. Ask for a decision.

## Quality bar

A good plan is specific. "Implement the axe runner" is not a plan. "Add a mapAxeImpactToSeverity function in src/runner/axe.ts that maps the four axe-core impact values to the three Foxhole severity values using the mapping table in the finding-normalization skill" is a plan.

If the plan cannot be written at this level of specificity, the task is not well enough defined. Stop and clarify before continuing.
