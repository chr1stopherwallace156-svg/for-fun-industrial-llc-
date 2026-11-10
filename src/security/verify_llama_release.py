"""Offline, read-only binary identity verification for Fun Industrial.

Never executes executables from either installation or ZIP. Requires exact official
archive SHA-256, checks selected ZIP members against a reviewed manifest, and
hashes the selected installed files. No network, shell, REA, or service changes.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import stat
import sys
import zipfile
from pathlib import Path

MANIFEST_PATH = Path(__file__).parent / "trusted-manifests" / "llama-b12102-win-cpu-x64.json"
OFFICIAL_ARCHIVE_SHA256 = "87d8c812e8a68a35de55c2e7caab280bf96199b79395045d7a67de4b1ad802a9"
OFFICIAL_COMMIT = "bbb02c93e9b83255b70ac1a755bb02b0a251f9a7"
COMPONENTS = (
    "llama-server.exe",
    "llama-server-impl.dll",
    "llama.dll",
    "llama-common.dll",
    "ggml.dll",
    "ggml-base.dll",
    "ggml-cpu-zen4.dll",
)
MAX_ARCHIVE_BYTES = 100 * 1024 * 1024
MAX_COMPONENT_BYTES = 32 * 1024 * 1024
HEX64 = re.compile(r"^[0-9a-f]{64}$")


class IntegrityHold(Exception):
    """Refuse to treat incomplete or invalid reference evidence as a pass."""


def regular_file(path: Path, limit: int) -> None:
    try:
        info = path.lstat()
    except OSError as exc:
        raise IntegrityHold("FILE_UNAVAILABLE") from exc
    if path.is_symlink() or not stat.S_ISREG(info.st_mode):
        raise IntegrityHold("FILE_NOT_REGULAR_OR_SYMLINK")
    if info.st_size <= 0 or info.st_size > limit:
        raise IntegrityHold("FILE_SIZE_OUT_OF_BOUNDS")


def sha256_file(path: Path, limit: int) -> str:
    regular_file(path, limit)
    before = path.lstat()
    digest = hashlib.sha256()
    read_size = 0
    try:
        with path.open("rb") as stream:
            while True:
                chunk = stream.read(1024 * 1024)
                if not chunk:
                    break
                read_size += len(chunk)
                if read_size > limit:
                    raise IntegrityHold("FILE_SIZE_OUT_OF_BOUNDS")
                digest.update(chunk)
    except OSError as exc:
        raise IntegrityHold("FILE_READ_FAILED") from exc
    after = path.lstat()
    if (before.st_size, before.st_mtime_ns, before.st_ino) != (
        after.st_size, after.st_mtime_ns, after.st_ino
    ) or read_size != before.st_size:
        raise IntegrityHold("FILE_CHANGED_WHILE_READING")
    return digest.hexdigest()


def validate_manifest(manifest: dict, *, pinned: bool) -> None:
    if not isinstance(manifest, dict) or set(manifest) != {
        "schema", "release", "source_repository", "source_commit",
        "source_release_url", "archive_name", "archive_sha256", "files"
    }:
        raise IntegrityHold("MANIFEST_SCHEMA_INVALID")
    if manifest["schema"] != "fun.binary-integrity-manifest.v1":
        raise IntegrityHold("MANIFEST_SCHEMA_INVALID")
    if not isinstance(manifest["files"], dict) or set(manifest["files"]) != set(COMPONENTS):
        raise IntegrityHold("MANIFEST_COMPONENTS_INVALID")
    if not isinstance(manifest["archive_sha256"], str) or not HEX64.fullmatch(manifest["archive_sha256"]):
        raise IntegrityHold("MANIFEST_ARCHIVE_SHA_INVALID")
    if any(not isinstance(h, str) or not HEX64.fullmatch(h) for h in manifest["files"].values()):
        raise IntegrityHold("MANIFEST_FILE_SHA_INVALID")
    if pinned and (
        manifest["release"] != "b12102"
        or manifest["source_repository"] != "ggml-org/llama.cpp"
        or manifest["source_commit"] != OFFICIAL_COMMIT
        or manifest["source_release_url"] != "https://github.com/ggml-org/llama.cpp/releases/tag/b12102"
        or manifest["archive_name"] != "llama-b12102-bin-win-cpu-x64.zip"
        or manifest["archive_sha256"] != OFFICIAL_ARCHIVE_SHA256
    ):
        raise IntegrityHold("MANIFEST_NOT_PINNED_OFFICIAL_RELEASE")


def verify(archive: Path, installed: Path, manifest: dict, *, pinned: bool = True) -> dict:
    validate_manifest(manifest, pinned=pinned)
    if sha256_file(archive, MAX_ARCHIVE_BYTES) != manifest["archive_sha256"]:
        raise IntegrityHold("REFERENCE_ARCHIVE_HASH_MISMATCH")
    if not installed.is_dir() or installed.is_symlink() or getattr(installed, "is_junction", lambda: False)():
        raise IntegrityHold("INSTALLED_DIRECTORY_UNSAFE_OR_MISSING")

    expected = manifest["files"]
    reference_hashes: dict[str, str] = {}
    try:
        with zipfile.ZipFile(archive, "r") as reference:
            entries: dict[str, list[zipfile.ZipInfo]] = {name: [] for name in COMPONENTS}
            for member in reference.infolist():
                if member.is_dir():
                    continue
                name = member.filename.replace("\\", "/").rsplit("/", 1)[-1]
                if name in entries:
                    entries[name].append(member)
            for name in COMPONENTS:
                if len(entries[name]) != 1:
                    raise IntegrityHold("REFERENCE_MEMBER_MISSING_OR_DUPLICATED")
                member = entries[name][0]
                if member.file_size <= 0 or member.file_size > MAX_COMPONENT_BYTES:
                    raise IntegrityHold("REFERENCE_MEMBER_TOO_LARGE")
                h = hashlib.sha256()
                total = 0
                with reference.open(member, "r") as source:
                    while True:
                        block = source.read(1024 * 1024)
                        if not block:
                            break
                        total += len(block)
                        if total > MAX_COMPONENT_BYTES:
                            raise IntegrityHold("REFERENCE_MEMBER_TOO_LARGE")
                        h.update(block)
                if total != member.file_size:
                    raise IntegrityHold("REFERENCE_MEMBER_SIZE_CHANGED")
                reference_hashes[name] = h.hexdigest()
                if reference_hashes[name] != expected[name]:
                    raise IntegrityHold("REFERENCE_MEMBER_HASH_MISMATCH")
    except (zipfile.BadZipFile, EOFError, RuntimeError, OSError) as exc:
        raise IntegrityHold("REFERENCE_ZIP_UNREADABLE") from exc

    results: list[dict] = []
    for name in COMPONENTS:
        local_path = installed / name
        try:
            actual = sha256_file(local_path, MAX_COMPONENT_BYTES)
            status = "MATCH" if actual == reference_hashes[name] else "MISMATCH"
            results.append({"file": name, "status": status, "installed_sha256": actual})
        except IntegrityHold as exc:
            results.append({"file": name, "status": "HOLD", "reason": str(exc)})
    matches = sum(row["status"] == "MATCH" for row in results)
    return {
        "event": "FUN_LOCAL_BINARY_INTEGRITY_RESULT",
        "state": "PASS" if matches == len(COMPONENTS) else "HOLD",
        "release": manifest["release"],
        "archive_integrity": "PASS",
        "reference_members_verified": len(COMPONENTS),
        "matched": matches,
        "required": len(COMPONENTS),
        "results": results,
        "executables_launched": 0,
        "network_requests": 0,
        "rea_tools_executed": 0,
        "scope": "SELECTED_BINARY_IDENTITY_ONLY_NOT_MALWARE_CERTIFICATION",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline compare installed llama.cpp files to a checksum-pinned official release ZIP.")
    parser.add_argument("--archive", required=True, type=Path, help="Previously downloaded official CPU x64 b12102 ZIP")
    parser.add_argument("--installed-dir", required=True, type=Path, help="Existing Fun Industrial llama.cpp runtime directory")
    args = parser.parse_args()
    try:
        regular_file(MANIFEST_PATH, 16 * 1024)
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        report = verify(args.archive, args.installed_dir, manifest, pinned=True)
    except (IntegrityHold, ValueError, json.JSONDecodeError) as exc:
        report = {
            "event": "FUN_LOCAL_BINARY_INTEGRITY_RESULT",
            "state": "HOLD",
            "reason": str(exc) if isinstance(exc, IntegrityHold) else "INVALID_REFERENCE_DATA",
            "executables_launched": 0,
            "network_requests": 0,
            "rea_tools_executed": 0,
        }
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["state"] == "PASS" else 2


if __name__ == "__main__":
    sys.exit(main())
