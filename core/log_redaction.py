import logging
import re

_PATTERNS = [
    (re.compile(r"(\w+://)[^/\s:@]+:[^@\s/]+@"), r"\1***:***@"),
    (re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._~+/=-]+"), r"\1***"),
    (re.compile(r"(?i)(x-miravelt-[a-z-]*key['\"]?\s*[:=]\s*['\"]?)[^\s'\",}]+"), r"\1***"),
    (re.compile(r"(?i)(refresh_token['\"]?\s*[:=]\s*['\"]?)[^\s'\",}]+"), r"\1***"),
]


def redact(text: str) -> str:
    for pattern, repl in _PATTERNS:
        text = pattern.sub(repl, text)
    return text


class RedactionFilter(logging.Filter):
    """Defense in depth: scrubs credentials/URIs with passwords from every record."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            record.msg = redact(record.getMessage())
            record.args = ()
        except Exception:  # noqa: S110 - best effort by design
            pass
        return True


def install_redaction() -> None:
    root = logging.getLogger()
    if not any(isinstance(f, RedactionFilter) for f in root.filters):
        root.addFilter(RedactionFilter())
    for handler in root.handlers:
        if not any(isinstance(f, RedactionFilter) for f in handler.filters):
            handler.addFilter(RedactionFilter())
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        for handler in logging.getLogger(name).handlers:
            if not any(isinstance(f, RedactionFilter) for f in handler.filters):
                handler.addFilter(RedactionFilter())
