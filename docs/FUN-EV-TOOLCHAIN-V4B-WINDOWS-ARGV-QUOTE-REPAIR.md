# Fun Industrial V4b — Native Windows PowerShell quote-preservation repair

## Original Windows facts, preserved as RED

The owner's V4a Windows qualification reported **23 PASS / 1 FAIL out of 24** tests. The failing test was the real Windows PowerShell argument-forwarding check: `node.exe : [eval]:1` in `Setup-Fun-EV-Toolchain-V4.ps1` at the native command helper. The fail-fast caller then reported `FUN_EV_V4A_TEST_HOLD`. There was **no new V4a install**, and `SelfTest` was not separately executed after the failed test run. Do not rewrite the failure as a PASS.

This exposed a second problem after V4's automatic `$Args`-name collision: PowerShell 5.1's native-command argument quoting can alter double-quote characters embedded in a script argument to `node.exe -e` and `python.exe -c`.

## Narrow Fun Industrial V4b successor

- Preserve V4 and V4a branch code, history, and failed real Windows tests.
- Keep the V4a `$ArgumentList` fix, explicit `SelfTest`, exact operator approval, and refusal to overwrite an existing WireViz target.
- Replace quote-sensitive Node command `process.argv.slice(1).join(",")` with `process.argv.slice(1).join(String.fromCharCode(44))`, **at both** self-test and pre-install gates.
- Replace the Python sentinel `",".join(sys.argv[1:])` with `chr(44).join(sys.argv[1:])`, and the fallback Python version print with `sep=chr(46)`.
- Add a small V4b test suite that explicitly bans the quoted command fragments and executes the quote-free Node expression. Retain the original V4 and V4a tests, including the **real Windows PowerShell native** process test.
- Introduce Windows CI with a native PowerShell parse and V4/V4a/V4b tests; no installer run.

## Claim ceiling

V4b is a source-only repair until the owner re-runs the actual native Windows tests and `SelfTest`. The new commands do NOT install any applications, change Windows packages, start/stop services, repair/delete partial folders, or touch any other project. `SelfTest` only reads whether an earlier V4 installation left the dedicated Fun Industrial WireViz folder, executable, Python virtual environment or wheel folder.

## Next operator qualification

1. From a new commit-pinned V4b checkout, run all V4, V4a and V4b tests.
2. On success, call `Setup-Fun-EV-Toolchain-V4.ps1 -Action SelfTest` (read-only).
3. Review the reported partial folder flags before any future installer attempt. Native WinGet package inventory, verified app versions, real WireViz renderer output, and FreeCAD GUI validation remain separate gates.

**Do not run `-Action Install` as part of V4b qualification.**
