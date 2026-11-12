"""Fails when a top-level guidance doc names a file that no longer exists (PROJECT_AUDIT.md E9).

Checks backtick-quoted repo paths (`engines/categorizer.py`, `frontend/src/lib/redirect.ts`) in
CLAUDE.md, ARCHITECTURE.md, PRD.md and frontend/CLAUDE.md. `path::symbol` also requires the symbol
to appear in the file. Run from anywhere: python scripts/check_docs.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ["CLAUDE.md", "ARCHITECTURE.md", "PRD.md", "frontend/CLAUDE.md"]
PATH_RE = re.compile(r"`((?:[\w.\-]+/)*[\w.\-]+\.(?:py|ts|tsx|json|ya?ml|md|sh))(?:::(\w+))?(?::\d+(?:-\d+)?)?`")
# Paths documented as living elsewhere, generated, or intentionally absent.
SKIP_PREFIXES = ("src/", "app/", "assets/", "tool/", "__tests__/", ".github/")
SKIP_NAMES = {".env", ".env.example", ".env.local", "app.json", "package.json"}


def resolve(doc: str, rel: str) -> Path | None:
    candidates = [ROOT / rel, ROOT / Path(doc).parent / rel]
    if rel.startswith(SKIP_PREFIXES) and doc.startswith("frontend/"):
        candidates.append(ROOT / "frontend" / rel)
    return next((c for c in candidates if c.exists()), None)


def main() -> int:
    problems: list[str] = []
    for doc in DOCS:
        path = ROOT / doc
        if not path.exists():
            continue
        for lineno, line in enumerate(path.read_text().splitlines(), 1):
            for m in PATH_RE.finditer(line):
                rel, symbol = m.group(1), m.group(2)
                if rel in SKIP_NAMES or rel.startswith("~"):
                    continue
                found = resolve(doc, rel)
                if found is None:
                    if rel.startswith(SKIP_PREFIXES) or "/" not in rel:
                        continue  # relative to a package we cannot guess; only flag full paths
                    problems.append(f"{doc}:{lineno}: `{rel}` does not exist")
                elif symbol and symbol not in found.read_text(errors="ignore"):
                    problems.append(f"{doc}:{lineno}: `{rel}` has no `{symbol}`")
    for p in problems:
        print(p)
    print(f"{len(problems)} stale reference(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
