# AI Development & Debugging Methodology

## MANDATORY PRE-WORK CHECKLIST
**Complete BEFORE making any code changes:**

### Phase 1: Problem Understanding
- [ ] **Define the exact problem/symptom**
  - What specifically is failing?
  - What is the expected vs actual behavior?
  - Are there error messages? Copy them verbatim.
  - When does it fail? Under what conditions?

- [ ] **Gather evidence**
  - Check logs, console output, error messages
  - Identify relevant files and line numbers
  - Note what was working vs what broke
  - Document the user's exact steps to reproduce

### Phase 2: Root Cause Investigation
- [ ] **NO ASSUMPTIONS - Trace the actual code path**
  - Use `read_files` to examine the relevant code
  - Follow the execution path step by step
  - Identify where the failure actually occurs
  - Use debugging/logging to confirm hypotheses

- [ ] **Search for ALL instances of the problem pattern**
  ```bash
  # Use these searches systematically:
  grep -r "failing_function_name" .
  grep -r "problematic_pattern" .
  find . -name "*.js" -o -name "*.ts" | xargs grep "pattern"
  ```

- [ ] **Create a hypothesis and VERIFY it**
  - Write down what you think is causing the issue
  - Add logging/debugging to prove or disprove it
  - Test the hypothesis before implementing fixes

### Phase 3: Comprehensive Solution Planning
- [ ] **List ALL affected areas**
  - Every file that uses the problematic pattern
  - Every function that might have the same issue
  - Every similar code path that needs checking

- [ ] **Plan fixes for ALL instances**
  - Don't fix just one occurrence
  - Ensure consistency across the entire codebase
  - Consider edge cases and error handling

## IMPLEMENTATION CHECKLIST

### During Development
- [ ] **Fix ALL instances of the problem**
  - Apply consistent solutions everywhere
  - Don't leave partial fixes
  - Update related documentation/comments

- [ ] **Add comprehensive error handling**
  - Handle edge cases
  - Provide meaningful error messages
  - Add fallback mechanisms where appropriate

- [ ] **Add debugging/logging for complex logic**
  ```typescript
  console.log('[DEBUG - ModuleName] Key action:', {
    input: inputData,
    expected: expectedResult,
    actual: actualResult,
    path: 'specific_code_path'
  });
  ```

### Testing & Verification
- [ ] **Test the main scenario**
- [ ] **Test edge cases**
- [ ] **Verify no regressions**
- [ ] **Check related functionality still works**

## SPECIFIC ISSUE PATTERNS TO WATCH FOR

### File System Operations
- [ ] Hidden files in Obsidian require `app.vault.adapter.read/write()`
- [ ] Never use `getAbstractFileByPath()` for hidden files
- [ ] Always check file existence before read/write operations
- [ ] Use consistent patterns for file access across the codebase

### UI Element State Management
- [ ] Checkbox state: Use `checkbox.checked = value` NOT `attr: { checked: value }`
- [ ] When fixing UI element patterns, search for ALL instances of the pattern
- [ ] DOM element properties vs attributes behave differently
- [ ] Test interactive elements (checkboxes, buttons, inputs) in both initial and changed states

### State Management
- [ ] UI state should reflect underlying data state
- [ ] Loading and saving operations must be symmetrical
- [ ] State updates should trigger UI refreshes
- [ ] Check for race conditions in async operations

### Error Handling
- [ ] Don't ignore "impossible" errors
- [ ] All async operations need try/catch
- [ ] Provide fallback behavior for failures
- [ ] Log errors with sufficient context

## QUALITY GATES
**DO NOT PROCEED unless these are satisfied:**

### Before Any Fix
- [ ] Root cause is identified and verified (not assumed)
- [ ] All instances of the problem are found
- [ ] Solution approach is planned comprehensively

### Before Submission
- [ ] All related code patterns are fixed consistently
- [ ] No assumptions are left unverified
- [ ] Testing covers main scenarios and edge cases
- [ ] No regressions are introduced

## RED FLAGS - STOP AND REASSESS IF:
- ❌ You're making assumptions about what "should" work
- ❌ You're fixing only one instance of a pattern
- ❌ You can't explain why something is failing
- ❌ You're ignoring error messages or test failures
- ❌ You're applying different solutions to the same problem
- ❌ You haven't verified your hypothesis with evidence

## SESSION STARTUP PROTOCOL
**At the beginning of each development session:**

1. **Read this methodology document**
2. **Ask: "What is the specific problem I need to solve?"**
3. **Ask: "Do I understand the root cause?"**
4. **Ask: "Have I found ALL instances of this issue?"**
5. **Ask: "How will I verify my solution works?"**

## EXAMPLE: Proper Investigation Flow

### ❌ Wrong Approach (What I did)
1. See UI not updating
2. Assume it's a specific UI function issue  
3. Fix only that one function
4. Ignore that metadata loading might have same issue
5. Deploy partial fix

### ✅ Correct Approach (What I should do)
1. **Problem**: UI shows wrong state for Q&A pairs
2. **Investigate**: Check how state is loaded vs displayed
3. **Root cause**: `getAbstractFileByPath()` fails on hidden files
4. **Search**: Find ALL uses of `getAbstractFileByPath()` with hidden files
5. **Fix**: Update ALL instances to use `app.vault.adapter`
6. **Verify**: Test loading AND saving of metadata
7. **Test**: Confirm UI reflects loaded state correctly

---

## COMMITMENT
I will follow this methodology for every development task. If I skip any step or make assumptions without verification, please remind me to restart with this checklist.
