#!/usr/bin/env python3
"""fetch-comments.py — deterministic GitHub PR review data fetch.

Fetches PR metadata, review threads, PR-level comments, and review
submissions through paginated GraphQL queries in parallel. Used by
the resolve-pr-comments skill as the data source for analysis.

Output JSON shape:
{
  "schema_version": 1,
  "source": "resolve-pr-comments/scripts/fetch-comments.py",
  "pull_request": {
    "owner", "repo", "number", "url", "title", "state",
    "author", "base_ref", "head_sha", "updated_at"
  },
  "conversation_comments": [...],   # PR-level comments
  "reviews": [...],                  # review submissions
  "review_threads": [...]            # inline review threads
}

PR-level comments containing `<!-- resolve-pr-comments:reply -->`
are prior skill replies; the agent must drop them before
classification. Only unresolved threads are actionable by default.

Run with --repo OWNER/REPO --pr 123 or --url <pr-url> for explicit PRs.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

MAX_GRAPHQL_ATTEMPTS = 3
TRANSIENT_ERROR_PATTERNS = (
    "timeout",
    "timed out",
    "502",
    "503",
    "504",
    "server error",
    "temporarily unavailable",
    "connection reset",
)


PR_QUERY = """\
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      number
      url
      title
      state
      updatedAt
      baseRefName
      headRefOid
      author { login }
    }
  }
}
"""

COMMENTS_QUERY = """\
query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      comments(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          databaseId
          body
          createdAt
          updatedAt
          author { login }
          authorAssociation
          reactionGroups {
            content
            users(first: 20) { nodes { login } totalCount }
          }
        }
      }
    }
  }
}
"""

REVIEWS_QUERY = """\
query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviews(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          state
          body
          submittedAt
          author { login }
        }
      }
    }
  }
}
"""

THREADS_QUERY = """\
query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          diffSide
          startLine
          startDiffSide
          originalLine
          originalStartLine
          comments(first: 100) {
            nodes {
              id
              databaseId
              body
              createdAt
              updatedAt
              author { login }
              authorAssociation
            }
          }
        }
      }
    }
  }
}
"""


def run(cmd: list[str], stdin: str | None = None) -> str:
    proc = subprocess.run(cmd, input=stdin, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{proc.stderr.strip()}")
    return proc.stdout


def run_json(cmd: list[str], stdin: str | None = None) -> dict[str, Any]:
    out = run(cmd, stdin=stdin)
    try:
        return json.loads(out)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Failed to parse JSON from {' '.join(cmd)}:\n{out}") from exc


def is_transient_error(message: str) -> bool:
    text = message.lower()
    return any(pattern in text for pattern in TRANSIENT_ERROR_PATTERNS)


def ensure_gh_auth() -> None:
    run(["gh", "auth", "status"])


def parse_pr_url(url: str) -> tuple[str, str, int]:
    match = re.search(r"github\.com[:/](?P<owner>[^/]+)/(?P<repo>[^/]+)/pull/(?P<number>\d+)", url)
    if not match:
        raise RuntimeError(f"Cannot parse PR URL: {url}")
    return match.group("owner"), match.group("repo"), int(match.group("number"))


def resolve_pr(args: argparse.Namespace) -> tuple[str, str, int]:
    if args.repo and args.pr:
        owner, repo = args.repo.split("/", 1)
        return owner, repo, int(args.pr)
    if args.url:
        return parse_pr_url(args.url)

    pr = run_json(["gh", "pr", "view", "--json", "url"])
    return parse_pr_url(pr["url"])


def normalize_author(author: dict[str, Any] | None) -> str | None:
    if not author:
        return None
    return author.get("login")


def positive_reactions(groups: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    positive = {"THUMBS_UP", "HOORAY", "ROCKET"}
    out: list[dict[str, Any]] = []
    for group in groups or []:
        content = group.get("content")
        if content not in positive:
            continue
        users = ((group.get("users") or {}).get("nodes")) or []
        for user in users:
            login = user.get("login")
            if login:
                out.append({"user": login, "content": content})
    return out


def normalize_issue_comment(node: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": node.get("databaseId"),
        "node_id": node.get("id"),
        "type": "pr_level",
        "body": node.get("body") or "",
        "created_at": node.get("createdAt"),
        "updated_at": node.get("updatedAt"),
        "author": normalize_author(node.get("author")),
        "author_association": node.get("authorAssociation"),
        "positive_reactions": positive_reactions(node.get("reactionGroups")),
    }


def normalize_review(node: dict[str, Any]) -> dict[str, Any]:
    return {
        "node_id": node.get("id"),
        "state": node.get("state"),
        "body": node.get("body") or "",
        "submitted_at": node.get("submittedAt"),
        "author": normalize_author(node.get("author")),
    }


def normalize_thread(node: dict[str, Any]) -> dict[str, Any]:
    comments = []
    for comment in ((node.get("comments") or {}).get("nodes")) or []:
        comments.append(
            {
                "id": comment.get("databaseId"),
                "node_id": comment.get("id"),
                "type": "inline",
                "body": comment.get("body") or "",
                "created_at": comment.get("createdAt"),
                "updated_at": comment.get("updatedAt"),
                "author": normalize_author(comment.get("author")),
                "author_association": comment.get("authorAssociation"),
            }
        )

    return {
        "thread_id": node.get("id"),
        "is_resolved": bool(node.get("isResolved")),
        "is_outdated": bool(node.get("isOutdated")),
        "path": node.get("path"),
        "line": node.get("line"),
        "start_line": node.get("startLine"),
        "original_line": node.get("originalLine"),
        "original_start_line": node.get("originalStartLine"),
        "diff_side": node.get("diffSide"),
        "start_diff_side": node.get("startDiffSide"),
        "comments": comments,
    }


def gh_graphql(query: str, owner: str, repo: str, number: int, cursor: str | None = None) -> dict[str, Any]:
    cmd = [
        "gh",
        "api",
        "graphql",
        "-F",
        "query=@-",
        "-F",
        f"owner={owner}",
        "-F",
        f"repo={repo}",
        "-F",
        f"number={number}",
    ]
    if cursor:
        cmd.extend(["-F", f"cursor={cursor}"])

    for attempt in range(1, MAX_GRAPHQL_ATTEMPTS + 1):
        try:
            payload = run_json(cmd, stdin=query)
        except RuntimeError as exc:
            if attempt < MAX_GRAPHQL_ATTEMPTS and is_transient_error(str(exc)):
                time.sleep(0.5 * attempt)
                continue
            raise

        errors = payload.get("errors")
        if errors and attempt < MAX_GRAPHQL_ATTEMPTS and is_transient_error(json.dumps(errors)):
            time.sleep(0.5 * attempt)
            continue
        return payload

    raise RuntimeError("unreachable GraphQL retry state")


def fetch_pr(owner: str, repo: str, number: int) -> dict[str, Any]:
    payload = gh_graphql(PR_QUERY, owner, repo, number)
    if payload.get("errors"):
        raise RuntimeError(json.dumps(payload["errors"], indent=2))
    pr = payload["data"]["repository"]["pullRequest"]
    return {
        "owner": owner,
        "repo": repo,
        "number": pr["number"],
        "url": pr["url"],
        "title": pr["title"],
        "state": pr["state"],
        "author": normalize_author(pr.get("author")),
        "base_ref": pr["baseRefName"],
        "head_sha": pr["headRefOid"],
        "updated_at": pr["updatedAt"],
    }


def local_head_sha() -> str | None:
    try:
        return run(["git", "rev-parse", "HEAD"]).strip()
    except RuntimeError:
        return None


def local_repo_matches(owner: str, repo: str) -> bool:
    try:
        name = run(["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]).strip()
    except RuntimeError:
        return False
    return name.lower() == f"{owner}/{repo}".lower()


def ensure_local_head_matches(owner: str, repo: str, pr_meta: dict[str, Any]) -> None:
    if not local_repo_matches(owner, repo):
        return

    local_sha = local_head_sha()
    if not local_sha:
        return

    pr_sha = pr_meta["head_sha"]
    if local_sha != pr_sha:
        raise RuntimeError(
            "Local checkout does not match PR head. "
            f"local HEAD={local_sha}, PR head={pr_sha}. "
            "Checkout or update the PR branch before resolving comments."
        )


def fetch_comments(owner: str, repo: str, number: int) -> list[dict[str, Any]]:
    comments: list[dict[str, Any]] = []
    cursor = None
    while True:
        payload = gh_graphql(COMMENTS_QUERY, owner, repo, number, cursor)
        if payload.get("errors"):
            raise RuntimeError(json.dumps(payload["errors"], indent=2))
        comments_page = payload["data"]["repository"]["pullRequest"]["comments"]
        comments.extend(normalize_issue_comment(n) for n in comments_page.get("nodes") or [])
        cursor = comments_page["pageInfo"]["endCursor"] if comments_page["pageInfo"]["hasNextPage"] else None
        if not cursor:
            break
    return comments


def fetch_reviews(owner: str, repo: str, number: int) -> list[dict[str, Any]]:
    reviews: list[dict[str, Any]] = []
    cursor = None
    while True:
        payload = gh_graphql(REVIEWS_QUERY, owner, repo, number, cursor)
        if payload.get("errors"):
            raise RuntimeError(json.dumps(payload["errors"], indent=2))
        reviews_page = payload["data"]["repository"]["pullRequest"]["reviews"]
        reviews.extend(normalize_review(n) for n in reviews_page.get("nodes") or [])
        cursor = reviews_page["pageInfo"]["endCursor"] if reviews_page["pageInfo"]["hasNextPage"] else None
        if not cursor:
            break
    return reviews


def fetch_threads(owner: str, repo: str, number: int) -> list[dict[str, Any]]:
    threads: list[dict[str, Any]] = []
    cursor = None
    while True:
        payload = gh_graphql(THREADS_QUERY, owner, repo, number, cursor)
        if payload.get("errors"):
            raise RuntimeError(json.dumps(payload["errors"], indent=2))
        threads_page = payload["data"]["repository"]["pullRequest"]["reviewThreads"]
        threads.extend(normalize_thread(n) for n in threads_page.get("nodes") or [])
        cursor = threads_page["pageInfo"]["endCursor"] if threads_page["pageInfo"]["hasNextPage"] else None
        if not cursor:
            break
    return threads


def fetch_all(owner: str, repo: str, number: int) -> dict[str, Any]:
    pr_meta = fetch_pr(owner, repo, number)
    ensure_local_head_matches(owner, repo, pr_meta)

    with ThreadPoolExecutor(max_workers=3) as executor:
        comments = executor.submit(fetch_comments, owner, repo, number)
        reviews = executor.submit(fetch_reviews, owner, repo, number)
        threads = executor.submit(fetch_threads, owner, repo, number)

        return {
            "schema_version": 1,
            "source": "resolve-pr-comments/scripts/fetch-comments.py",
            "pull_request": pr_meta,
            "conversation_comments": comments.result(),
            "reviews": reviews.result(),
            "review_threads": threads.result(),
        }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", help="Base repository in owner/repo form")
    parser.add_argument("--pr", type=int, help="Pull request number")
    parser.add_argument("--url", help="Pull request URL")
    args = parser.parse_args()

    if bool(args.repo) ^ bool(args.pr):
        parser.error("--repo and --pr must be provided together")

    try:
        ensure_gh_auth()
        owner, repo, number = resolve_pr(args)
        print(json.dumps(fetch_all(owner, repo, number), indent=2, sort_keys=True))
    except Exception as exc:  # noqa: BLE001 - command-line tool should render exact blocker
        print(f"fetch-comments.py: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
