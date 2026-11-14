# Fun Industrial V4a — Windows native argument forwarding repair

## Preserved failure
Operator's Windows V4 source tests: **21/21 PASS**. V4 Plan showed WinGet and Python 3.12 installed. After explicit installation approval, WinGet printed only its generic command help for each attempted \`show\` / \`install\` call; Python 3.12 entered its interactive \`>>>\` REPL rather than executing \`-m venv\`. This is **not** installation success. Original V4 release/PR #62 is preserved for evidence.

## Root cause and repair
V4's PowerShell function declared \`[string[]]$Args\`, colliding case-insensitively with PowerShell's **automatic \`$args\` variable**. Native program argument lists were not forwarded correctly. V4a uses \`$ArgumentList\` with \`@ArgumentList\` splatting, refuses empty argument lists, detects native help/REPL output, verifies Node argument forwarding with two sentinel values, and offers a **read-only SelfTest** that exercises Node, Python and WinGet versions with real native process calls.

Source-only checks now also verify helper names, ordering and guard presence. CI on Windows must actually run the PowerShell SelfTest; source regex passes by themselves are not sufficient.

## One safe operator command
Use a new, SHA-pinned checkout of V4a, run \`node --test test/ev-toolchain-v4.test.mjs test/ev-toolchain-v4a.test.mjs\`, then \`.\Setup-Fun-EV-Toolchain-V4.ps1 -Action SelfTest\`. The output reports \`wireviz_target_exists\`.

**DO NOT rerun Install yet.** V4 could have created \`%LOCALAPPDATA%\FunIndustrial\EVEngineering\Tools\WireViz\` before Python entered the REPL; an existing directory must be inspected manually. The installer intentionally refuses to overwrite it. V4a does not automatically delete, migrate, modify or repair this path. WinGet generic help output does not prove it installed any apps; independent read-only package inventory is needed before attempting installation.

## Boundaries
Fun Industrial-only. No other project access, no dashboard, no service restart, no task creation, no live vehicle, no shell downloads or package changes from SelfTest. \`-Action Install\` remains separately authorization-gated and is not part of this qualification.

## Next release gate
Native Windows PowerShell SelfTest PASS; read-only status of any partial Fun directory; verify exact package IDs and versions with native WinGet outputs; then separately authorize a reviewed installer that can reconcile already-present packages and a partial venv without destructive cleanup. No CAD/harness runtime qualification is claimed by V4a.
