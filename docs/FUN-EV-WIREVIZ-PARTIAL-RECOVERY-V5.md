# Fun Industrial V5 — WireViz partial installation recovery

## Windows evidence and limits
The owner reports that V4b passed **27/27 source/native tests** and the read-only command-forwarding SelfTest. Its separate status flags showed the Fun Industrial WireViz directory exists and its wheels folder exists, but the venv Python and WireViz executable are missing. V4b did **not** install packages. The earlier failed V4 installer left a partially created Fun-only target. The content of the wheel folder and whether the venv directory exists remain unknown until V5 Audit.

## Safe initial step (no installation)
```powershell
.\Recover-Fun-EV-WireViz-V5.ps1 -Action Audit
```
Audit is the default and only reads `%LOCALAPPDATA%\FunIndustrial\EVEngineering\Tools\WireViz`, its known parent directories and files. It checks directory reparse points; reads only wheel filenames, sizes and SHA-256; reports existing venv folder and executables; refuses unsafe entries. It never downloads, installs, deletes, overwrites, starts/stops services or alters other projects.

## Recovery is separate and requires explicit approval
```powershell
.\Recover-Fun-EV-WireViz-V5.ps1 -Action Recover -Approval APPROVE_FUN_EV_WIREVIZ_RECOVERY
```
Do **not** issue Recover until the actual owner's Audit output has been reviewed.

Recover is eligible only if the target contains no unexpected files and **no venv directory**, and any pre-existing wheel is exactly `wireviz-0.4.1-py3-none-any.whl` with the known PyPI SHA-256 `5dfdfec91e5d26e4f27f0f9d031672da7fb3c133d127167d233f4742f01873a2`. It then creates a venv in its final Fun-only folder using Python 3.12, downloads binary-only WireViz 0.4.1 and dependencies to the Fun-only wheels directory, checks the primary package hash, installs from those local wheel files only, verifies `pip check` and `wireviz --version`, and writes a manifest of downloaded wheel hashes and installed packages.

Important: transitive Python dependencies are downloaded from package indexes and only hashed *after* retrieval. They are not pre-locked by independent hashes; additional supply-chain review is required for production use. An interrupted recovery can leave a partial venv, and the script intentionally refuses future overwrites and deletes. No automatic cleanup or rollback is performed.

## Qualification ceiling
WireViz installed is not WireViz native rendering qualified. Graphviz must be installed and verified separately for SVG rendering. FreeCAD and QElectroTech also need separate native installation and user-level functionality checks. V2 artifacts remain an unpowered synthetic bench example, not an automotive schematic, verified design, or high-voltage authorization.

## Testing
```powershell
node --test test/ev-wireviz-recovery-v5.test.mjs
```
The test includes a **real read-only Windows PowerShell audit** plus source guardrails. No test runs Recover. A companion Windows CI workflow runs AST parsing and Audit, never installation.

## Source
https://pypi.org/project/wireviz/0.4.1/
