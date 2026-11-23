#!/usr/bin/env python3
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, urlsplit


class LocalStaticHandler(SimpleHTTPRequestHandler):
    allowed_suffixes = {".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico"}

    def __init__(self, *args, directory, default_index, **kwargs):
        self.root = directory
        self.default_index = default_index
        super().__init__(*args, directory=str(directory), **kwargs)

    def send_head(self):
        try:
            if urlsplit(self.path).path in ("", "/"):
                self.path = "/" + quote(self.default_index)
            candidate = Path(self.translate_path(self.path)).resolve()
            relative = candidate.relative_to(self.root)
        except (OSError, RuntimeError, ValueError):
            self.send_error(404)
            return None
        if (
            not candidate.is_file()
            or candidate.suffix.lower() not in self.allowed_suffixes
            or any(part.startswith(".") or ":" in part for part in relative.parts)
        ):
            self.send_error(404)
            return None
        return super().send_head()

    def log_request(self, code="-", size="-"):
        self.log_message("%s %s", self.command, code)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description="Serve local static pages.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    parser.add_argument("--directory", type=Path, default=Path.cwd())
    parser.add_argument("--index", default="depplink测试.html")
    args = parser.parse_args()

    root = args.directory.resolve()
    index = Path(args.index)
    if (
        index.name != args.index
        or index.name.startswith(".")
        or ":" in index.name
        or index.suffix.lower() != ".html"
        or not (root / index).is_file()
    ):
        parser.error("--index must be an existing HTML file directly inside --directory")
    handler = functools.partial(LocalStaticHandler, directory=root, default_index=index.name)

    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving {root} at http://{args.host}:{server.server_port}/", flush=True)
    print(f"Default page: {index.name}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
