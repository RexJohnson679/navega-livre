"""Publish the version catalog with the repository's short-lived Actions token.

Only packages and checked notes from this repository are sent to GitHub.
Drafts become public after all their attachments have passed integrity checks.
Existing public notes and existing attachments are never replaced.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import Request, HTTPRedirectHandler, build_opener

REPOSITORY = "RexJohnson679/navega-livre"
API = "https://api.github.com"
ROOT = Path(__file__).resolve().parents[2]


class ApiError(RuntimeError):
    def __init__(self, status, message):
        super().__init__(f"GitHub HTTP {status}: {message}")
        self.status = status


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


class Client:
    def __init__(self, token):
        if not token:
            raise ValueError("GITHUB_TOKEN não está disponível.")
        self.token = token
        self.opener = build_opener(NoRedirect())

    def request(self, method, url, payload=None, data=None, content_type=None):
        origin = urlsplit(url)
        if origin.scheme != "https" or origin.hostname not in {"api.github.com", "uploads.github.com"}:
            raise ValueError("Destino de API não permitido.")
        headers = {"Authorization": f"Bearer {self.token}", "Accept": "application/vnd.github+json",
                   "X-GitHub-Api-Version": "2026-03-10", "User-Agent": "Navega-Livre-Releases"}
        if payload is not None:
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        elif data is not None:
            headers["Content-Type"] = content_type or "application/octet-stream"
        for attempt in range(3):
            try:
                with self.opener.open(Request(url, data=data, headers=headers, method=method), timeout=60) as response:
                    raw = response.read()
                    return json.loads(raw) if raw else None
            except HTTPError as error:
                raw = error.read()
                try:
                    message = json.loads(raw).get("message", error.reason)
                except (ValueError, AttributeError):
                    message = error.reason
                if error.code in {429, 500, 502, 503, 504} and attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                # Request headers and the credential are not logged.
                raise ApiError(error.code, str(message)[:300]) from None


def checked_path(root, value, prefix):
    if not isinstance(value, str) or Path(value).is_absolute() or ".." in Path(value).parts:
        raise ValueError("Caminho de arquivo inválido.")
    expected = (root / prefix).resolve()
    path = (root / value).resolve()
    if expected not in path.parents or not path.is_file():
        raise ValueError(f"Arquivo fora da pasta permitida: {value}")
    return path


def validate_catalog(root, catalog, commit):
    if not re.fullmatch(r"[0-9a-f]{40}", commit or ""):
        raise ValueError("Commit do workflow inválido.")
    tags = []
    latest = []
    for item in catalog:
        tag = item.get("tag", "")
        if not re.fullmatch(r"v\d+\.\d+\.\d+", tag) or tag in tags:
            raise ValueError("Etiqueta de versão inválida ou repetida.")
        tags.append(tag)
        target = item.get("target", "current")
        if target != "current" and not re.fullmatch(r"[0-9a-f]{40}", target):
            raise ValueError("Commit do snapshot inválido.")
        checked_path(root, item["notes"], ".github/release-notes")
        names = set()
        for asset in item["assets"]:
            path = checked_path(root, asset["path"], "packages")
            if path.name in names or path.suffix not in {".zip", ".txt"}:
                raise ValueError("Nome ou tipo de anexo inválido.")
            names.add(path.name)
            if hashlib.sha256(path.read_bytes()).hexdigest() != asset["sha256"]:
                raise ValueError(f"Anexo alterado: {path.name}")
        if item.get("latest"):
            latest.append(tag)
    highest = max(tags, key=lambda tag: tuple(map(int, tag[1:].split(".")))) if tags else None
    if latest != [highest]:
        raise ValueError("Somente a versão mais nova deve ser marcada como atual.")


def existing_releases(client):
    result = {}
    for page in range(1, 21):
        batch = client.request("GET", f"{API}/repos/{REPOSITORY}/releases?per_page=100&page={page}")
        for release in batch:
            result[release["tag_name"]] = release
        if len(batch) < 100:
            return result
    raise ValueError("Limite de paginação atingido; revise o catálogo.")


def publish_one(client, root, item, commit, release=None):
    tag = item["tag"]
    body = checked_path(root, item["notes"], ".github/release-notes").read_text(encoding="utf-8")
    target = commit if item.get("target", "current") == "current" else item["target"]
    if release is None:
        release = client.request("POST", f"{API}/repos/{REPOSITORY}/releases", payload={
            "tag_name": tag, "target_commitish": target, "name": item["name"], "body": body,
            "draft": True, "prerelease": False, "make_latest": "false", "generate_release_notes": False})
    elif release.get("draft") and release.get("body") != body:
        raise ValueError(f"O rascunho {tag} tem notas diferentes; revise antes de publicar.")
    assets = {asset["name"]: asset for asset in release.get("assets", [])}
    upload = release["upload_url"].split("{", 1)[0]
    expected_path = f"/repos/{REPOSITORY}/releases/{release['id']}/assets"
    if urlsplit(upload).hostname != "uploads.github.com" or urlsplit(upload).path != expected_path:
        raise ValueError("Endereço de upload inválido.")
    for asset in item["assets"]:
        path = checked_path(root, asset["path"], "packages")
        data = path.read_bytes()
        attached = assets.get(path.name)
        if attached is None:
            if release.get("immutable"):
                raise ValueError(f"O lançamento {tag} é imutável e está sem {path.name}.")
            attached = client.request("POST", upload + "?" + urlencode({"name": path.name}), data=data,
                                      content_type="application/zip" if path.suffix == ".zip" else "text/plain")
        if attached.get("size") != len(data):
            raise ValueError(f"Tamanho incorreto do anexo {path.name}.")
        digest = attached.get("digest")
        if digest and digest != "sha256:" + asset["sha256"]:
            raise ValueError(f"Conteúdo diferente do anexo {path.name}; ele não foi substituído.")
    if release.get("draft"):
        release = client.request("PATCH", f"{API}/repos/{REPOSITORY}/releases/{release['id']}", payload={
            "draft": False, "make_latest": "true" if item.get("latest") else "false"})
    print(f"Publicado {tag}: {release['html_url']}", flush=True)
    return release


def main():
    if os.environ.get("GITHUB_REPOSITORY") != REPOSITORY or os.environ.get("GITHUB_REF") != "refs/heads/main":
        raise ValueError("Este publicador funciona somente na branch main do repositório esperado.")
    catalog = json.loads((ROOT / ".github/release-history.json").read_text(encoding="utf-8"))
    commit = os.environ.get("GITHUB_SHA", "")
    validate_catalog(ROOT, catalog, commit)
    client = Client(os.environ.get("GITHUB_TOKEN"))
    current = existing_releases(client)
    for item in catalog:
        publish_one(client, ROOT, item, commit, current.get(item["tag"]))
        time.sleep(1)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Falha na publicação: {error}", file=sys.stderr)
        sys.exit(1)
