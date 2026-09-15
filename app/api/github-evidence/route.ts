import { NextResponse } from "next/server";

const GITHUB_API = "https://api.github.com";
const NAME = /^[A-Za-z0-9_.-]+$/;

type GitHubUser = { login?: string };
type Pull = {
  number?: number;
  title?: string;
  body?: string | null;
  state?: string;
  merged_at?: string | null;
  html_url?: string;
  user?: GitHubUser;
  updated_at?: string;
};
type Commit = {
  html_url?: string;
  sha?: string;
  commit?: { message?: string; author?: { name?: string; date?: string } };
  author?: GitHubUser | null;
};
type Issue = {
  number?: number;
  title?: string;
  body?: string | null;
  state?: string;
  html_url?: string;
  user?: GitHubUser;
  pull_request?: unknown;
};

function parseRepository(input: string) {
  const trimmed = input.trim().replace(/\.git$/i, "");
  let owner = "";
  let repo = "";
  try {
    const url = trimmed.startsWith("http") ? new URL(trimmed) : null;
    if (url && url.hostname.toLowerCase() === "github.com") {
      [owner = "", repo = ""] = url.pathname.split("/").filter(Boolean);
    } else {
      [owner = "", repo = ""] = trimmed.split("/").filter(Boolean);
    }
  } catch {
    return null;
  }
  if (!NAME.test(owner) || !NAME.test(repo)) return null;
  return { owner, repo };
}

async function github(path: string, accept = "application/vnd.github+json") {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: accept,
      "User-Agent": "Understudy-Handoff",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (response.status === 403 && remaining === "0") throw new Error("GitHub's public API rate limit was reached. Try again later.");
    if (response.status === 404) throw new Error("Repository not found. Step 11 currently imports public repositories only.");
    throw new Error(`GitHub returned ${response.status}.`);
  }
  return response;
}

function clean(value: string | null | undefined, max = 1200) {
  return (value ?? "").replace(/\r/g, "").trim().slice(0, max);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { repository?: string; contributor?: string };
    const parsed = parseRepository(body.repository ?? "");
    if (!parsed) return NextResponse.json({ error: "Enter a GitHub repository as owner/repo or a github.com repository URL." }, { status: 400 });
    const contributor = (body.contributor ?? "").trim().replace(/^@/, "");
    if (contributor && !NAME.test(contributor)) return NextResponse.json({ error: "GitHub username is invalid." }, { status: 400 });

    const { owner, repo } = parsed;
    const repoResponse = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    const repository = (await repoResponse.json()) as {
      full_name?: string;
      description?: string | null;
      html_url?: string;
      default_branch?: string;
      language?: string | null;
      topics?: string[];
      open_issues_count?: number;
      private?: boolean;
      archived?: boolean;
      updated_at?: string;
    };
    if (repository.private) return NextResponse.json({ error: "Step 11 currently imports public GitHub repositories only." }, { status: 400 });

    let readme = "";
    try {
      const response = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`, "application/vnd.github.raw+json");
      readme = clean(await response.text(), 10_000);
    } catch {
      // A README is helpful but not required.
    }

    const query = contributor ? `?state=all&per_page=50&sort=updated&direction=desc` : `?state=all&per_page=25&sort=updated&direction=desc`;
    const pullsResponse = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls${query}`);
    const pulls = ((await pullsResponse.json()) as Pull[])
      .filter((item) => !contributor || item.user?.login?.toLowerCase() === contributor.toLowerCase())
      .slice(0, 20);

    const commitsResponse = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=30${contributor ? `&author=${encodeURIComponent(contributor)}` : ""}`);
    const commits = ((await commitsResponse.json()) as Commit[]).slice(0, 20);

    const issuesResponse = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=all&per_page=30&sort=updated&direction=desc`);
    const issues = ((await issuesResponse.json()) as Issue[])
      .filter((item) => !item.pull_request)
      .filter((item) => !contributor || item.user?.login?.toLowerCase() === contributor.toLowerCase())
      .slice(0, 12);

    const lines = [
      `# GitHub evidence: ${repository.full_name ?? `${owner}/${repo}`}`,
      `Repository: ${repository.html_url ?? `https://github.com/${owner}/${repo}`}`,
      `Description: ${clean(repository.description, 500) || "No repository description"}`,
      `Primary language: ${repository.language ?? "Unknown"}`,
      `Default branch: ${repository.default_branch ?? "Unknown"}`,
      `Repository updated: ${repository.updated_at ?? "Unknown"}`,
      contributor ? `Contributor focus: @${contributor}` : "Contributor focus: whole repository",
      repository.topics?.length ? `Topics: ${repository.topics.join(", ")}` : "",
      "",
      readme ? `## README\n${readme}` : "",
      "",
      `## Pull requests${contributor ? ` by @${contributor}` : ""}`,
      ...(pulls.length
        ? pulls.map((pull) => `- #${pull.number} ${clean(pull.title, 240)} [${pull.merged_at ? "merged" : pull.state ?? "unknown"}]${pull.updated_at ? ` · updated ${pull.updated_at}` : ""}\n  ${clean(pull.body, 700)}\n  ${pull.html_url ?? ""}`)
        : ["- No matching pull requests were returned."]),
      "",
      `## Recent commits${contributor ? ` associated with @${contributor}` : ""}`,
      ...(commits.length
        ? commits.map((commit) => `- ${commit.sha?.slice(0, 7) ?? "commit"}: ${clean(commit.commit?.message?.split("\n")[0], 260)}${commit.commit?.author?.date ? ` · ${commit.commit.author.date}` : ""}\n  ${commit.html_url ?? ""}`)
        : ["- No matching commits were returned."]),
      "",
      `## Issues${contributor ? ` opened by @${contributor}` : ""}`,
      ...(issues.length
        ? issues.map((issue) => `- #${issue.number} ${clean(issue.title, 240)} [${issue.state ?? "unknown"}]\n  ${clean(issue.body, 500)}\n  ${issue.html_url ?? ""}`)
        : ["- No matching issues were returned."]),
    ].filter(Boolean);

    return NextResponse.json({
      title: `${repository.full_name ?? `${owner}/${repo}`} GitHub activity${contributor ? ` · @${contributor}` : ""}`,
      provider: "GitHub",
      repository: repository.full_name ?? `${owner}/${repo}`,
      contributor: contributor || null,
      text: lines.join("\n").slice(0, 55_000),
      counts: { pullRequests: pulls.length, commits: commits.length, issues: issues.length },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "GitHub import failed." }, { status: 502 });
  }
}
