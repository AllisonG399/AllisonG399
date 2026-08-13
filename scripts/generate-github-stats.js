const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const GITHUB_TOKEN = process.env.METRICS_TOKEN;
const GITHUB_USER = "AllisonG399";

const OUTPUT_DIR = path.join(
  __dirname,
  "..",
  "assets"
);

const OUTPUT_FILE = path.join(
  OUTPUT_DIR,
  "github-stats.svg"
);

/*
 * --------------------------------------------------
 * Configuration
 * --------------------------------------------------
 */

const COLORS = {
  background: "#FDFBF9",
  text: "#743014",
  muted: "#9A6A55",
  border: "#E8DCD5",
};

const CARD_WIDTH = 250;
const CARD_HEIGHT = 120;
const CARD_GAP = 20;

const FONT_FAMILY =
  "Arial, Helvetica, sans-serif";

/*
 * Source-code extensions to count.
 */
const CODE_EXTENSIONS = new Set([
  // JavaScript / TypeScript
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",

  // Java / Kotlin
  ".java",
  ".kt",
  ".kts",

  // Web
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sass",
  ".less",

  // Data / markup
  ".xml",
  ".json",
  ".yaml",
  ".yml",

  // SQL
  ".sql",

  // Python
  ".py",

  // C / C++
  ".c",
  ".h",
  ".cpp",
  ".hpp",

  // C#
  ".cs",

  // PHP
  ".php",

  // Ruby
  ".rb",

  // Go
  ".go",

  // Rust
  ".rs",

  // Swift
  ".swift",

  // Shell
  ".sh",
  ".bash",

  // PowerShell
  ".ps1",

  // Markdown / documentation
  ".md",
  ".mdx",
]);

/*
 * Directories that should never contribute
 * to the lines-of-code count.
 */
const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".output",
  "out",
  "target",
  "bin",
  "obj",
  "venv",
  ".venv",
  "__pycache__",
  ".gradle",
  ".idea",
  ".vscode",
]);

/*
 * Files that should not be counted even if
 * their extension normally qualifies.
 */
const EXCLUDED_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "composer.lock",
  "Gemfile.lock",
]);

/*
 * --------------------------------------------------
 * GitHub API
 * --------------------------------------------------
 */

async function githubRequest(endpoint) {
  const response = await fetch(
    `https://api.github.com${endpoint}`,
    {
      headers: {
        Accept:
          "application/vnd.github+json",
        Authorization:
          `Bearer ${GITHUB_TOKEN}`,
        "X-GitHub-Api-Version":
          "2026-03-10",
        "User-Agent":
          "AllisonG399-GitHub-Stats",
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `GitHub API error ${response.status}: ${text}`
    );
  }

  return response.json();
}

/*
 * --------------------------------------------------
 * Get repositories
 * --------------------------------------------------
 */

async function getRepositories() {
  const repositories = [];

  let page = 1;

  while (true) {
    console.log(
      `Fetching repositories (page ${page})...`
    );

    const repos =
      await githubRequest(
        `/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&per_page=100&page=${page}`
      );

    if (repos.length === 0) {
      break;
    }

    repositories.push(...repos);

    if (repos.length < 100) {
      break;
    }

    page++;
  }

  /*
   * Only count repositories owned by the user.
   *
   * This prevents repositories where Allison is
   * merely a collaborator from being included in
   * the current-lines-of-code total.
   */
  return repositories.filter(
    (repo) =>
      repo.owner.login.toLowerCase() ===
        GITHUB_USER.toLowerCase() &&
      !repo.fork &&
      !repo.archived &&
      !repo.disabled &&
      repo.size > 0
  );
}

/*
 * --------------------------------------------------
 * Count commits
 * --------------------------------------------------
 */

async function countUserCommits(repo) {
  let total = 0;
  let page = 1;

  while (true) {
    const commits =
      await githubRequest(
        `/repos/${repo.owner.login}/${repo.name}/commits?author=${encodeURIComponent(
          GITHUB_USER
        )}&per_page=100&page=${page}`
      );

    if (commits.length === 0) {
      break;
    }

    total += commits.length;

    if (commits.length < 100) {
      break;
    }

    page++;
  }

  return total;
}

/*
 * --------------------------------------------------
 * Count lines in a repository
 * --------------------------------------------------
 *
 * We clone only the current default branch with
 * depth=1. This gives us the CURRENT contents of
 * the repository rather than historical changes.
 */

function countLinesInRepository(repo) {
  const tempDirectory = fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "github-stats-"
    )
  );

  const repositoryPath =
    path.join(
      tempDirectory,
      repo.name
    );

  try {
    console.log(
      `Cloning ${repo.full_name}...`
    );

    /*
     * Clone only the current snapshot.
     *
     * The token is provided through an environment
     * variable so it isn't written directly into
     * the command arguments.
     */
    const askPassScript =
      path.join(
        tempDirectory,
        "git-askpass.sh"
      );

    fs.writeFileSync(
      askPassScript,
      `#!/bin/sh
case "$1" in
  *Username*) echo "x-access-token" ;;
  *Password*) echo "$METRICS_TOKEN" ;;
esac
`
    );

    fs.chmodSync(
      askPassScript,
      0o700
    );

    const env = {
      ...process.env,
      GIT_ASKPASS: askPassScript,
      GIT_TERMINAL_PROMPT: "0",
    };

    execFileSync(
      "git",
      [
        "clone",
        "--depth",
        "1",
        "--single-branch",
        "--quiet",
        `https://github.com/${repo.full_name}.git`,
        repositoryPath,
      ],
      {
        env,
        stdio: "inherit",
      }
    );

    /*
     * Get tracked files only.
     */
    const fileList =
      execFileSync(
        "git",
        [
          "-C",
          repositoryPath,
          "ls-files",
          "-z",
        ],
        {
          encoding: "utf8",
        }
      );

    const files =
      fileList
        .split("\0")
        .filter(Boolean);

    let totalLines = 0;

    for (const relativePath of files) {
      const normalized =
        relativePath.replace(
          /\\/g,
          "/"
        );

      const parts =
        normalized.split("/");

      /*
       * Skip excluded directories.
       */
      if (
        parts.some((part) =>
          EXCLUDED_DIRECTORIES.has(
            part
          )
        )
      ) {
        continue;
      }

      const filename =
        parts[parts.length - 1];

      if (
        EXCLUDED_FILES.has(filename)
      ) {
        continue;
      }

      const extension =
        path.extname(filename)
          .toLowerCase();

      if (
        !CODE_EXTENSIONS.has(
          extension
        )
      ) {
        continue;
      }

      const absolutePath =
        path.join(
          repositoryPath,
          relativePath
        );

      try {
        const buffer =
          fs.readFileSync(
            absolutePath
          );

        /*
         * Skip files containing null bytes.
         * Those are almost certainly binary files.
         */
        if (
          buffer.includes(0)
        ) {
          continue;
        }

        const content =
          buffer.toString("utf8");

        if (content.length === 0) {
          continue;
        }

        /*
         * Count actual lines.
         *
         * split(/\r?\n/) handles both
         * Windows and Unix line endings.
         */
        const lines =
          content.split(/\r?\n/);

        /*
         * If the file ends with a newline,
         * split() produces one empty element.
         */
        const lineCount =
          content.endsWith("\n") ||
          content.endsWith("\r")
            ? lines.length - 1
            : lines.length;

        totalLines += lineCount;
      } catch (error) {
        console.warn(
          `⚠ Could not read ${relativePath}`
        );
      }
    }

    return totalLines;
  } finally {
    /*
     * Remove temporary clone.
     */
    fs.rmSync(
      tempDirectory,
      {
        recursive: true,
        force: true,
      }
    );
  }
}

/*
 * --------------------------------------------------
 * Number formatting
 * --------------------------------------------------
 */

function formatNumber(number) {
  return new Intl.NumberFormat(
    "en-US"
  ).format(number);
}

/*
 * --------------------------------------------------
 * SVG generation
 * --------------------------------------------------
 */

function createStatsSvg(
  commits,
  lines
) {
  const totalWidth =
    CARD_WIDTH * 2 +
    CARD_GAP;

  const totalHeight =
    CARD_HEIGHT;

  const commitX = 0;

  const linesX =
    CARD_WIDTH +
    CARD_GAP;

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${totalWidth}"
  height="${totalHeight}"
  viewBox="0 0 ${totalWidth} ${totalHeight}"
  role="img"
  aria-labelledby="title desc"
>
  <title id="title">
    GitHub coding statistics
  </title>

  <desc id="desc">
    ${formatNumber(commits)} commits and
    ${formatNumber(lines)} lines of code
  </desc>

  <!-- Commit Card -->
  <rect
    x="${commitX}"
    y="0"
    width="${CARD_WIDTH}"
    height="${CARD_HEIGHT}"
    rx="16"
    fill="${COLORS.background}"
    stroke="${COLORS.border}"
    stroke-width="1"
  />

  <text
    x="${commitX + CARD_WIDTH / 2}"
    y="51"
    text-anchor="middle"
    fill="${COLORS.text}"
    font-family="${FONT_FAMILY}"
    font-size="30"
    font-weight="700"
  >
    ${formatNumber(commits)}
  </text>

  <text
    x="${commitX + CARD_WIDTH / 2}"
    y="80"
    text-anchor="middle"
    fill="${COLORS.muted}"
    font-family="${FONT_FAMILY}"
    font-size="12"
    font-weight="600"
    letter-spacing="1.5"
  >
    COMMITS
  </text>

  <!-- Lines Card -->
  <rect
    x="${linesX}"
    y="0"
    width="${CARD_WIDTH}"
    height="${CARD_HEIGHT}"
    rx="16"
    fill="${COLORS.background}"
    stroke="${COLORS.border}"
    stroke-width="1"
  />

  <text
    x="${linesX + CARD_WIDTH / 2}"
    y="51"
    text-anchor="middle"
    fill="${COLORS.text}"
    font-family="${FONT_FAMILY}"
    font-size="30"
    font-weight="700"
  >
    ${formatNumber(lines)}
  </text>

  <text
    x="${linesX + CARD_WIDTH / 2}"
    y="80"
    text-anchor="middle"
    fill="${COLORS.muted}"
    font-family="${FONT_FAMILY}"
    font-size="12"
    font-weight="600"
    letter-spacing="1.5"
  >
    LINES OF CODE
  </text>
</svg>
`.trim();
}

/*
 * --------------------------------------------------
 * Main
 * --------------------------------------------------
 */

async function main() {
  if (!GITHUB_TOKEN) {
    throw new Error(
      "METRICS_TOKEN environment variable is missing."
    );
  }

  console.log(
    "\n📊 Generating GitHub statistics...\n"
  );

  const repositories =
    await getRepositories();

  console.log(
    `\nFound ${repositories.length} repositories to analyze.\n`
  );

  let totalCommits = 0;
  let totalLines = 0;

  for (const repo of repositories) {
    console.log(
      `\n────────────────────────────────`
    );

    console.log(
      `Repository: ${repo.full_name}`
    );

    /*
     * Count commits authored by Allison.
     */
    const commits =
      await countUserCommits(repo);

    console.log(
      `Commits: ${commits}`
    );

    totalCommits += commits;

    /*
     * Count current source-code lines.
     */
    const lines =
      countLinesInRepository(repo);

    console.log(
      `Current lines of code: ${lines}`
    );

    totalLines += lines;
  }

  /*
   * Make sure assets directory exists.
   */
  fs.mkdirSync(
    OUTPUT_DIR,
    {
      recursive: true,
    }
  );

  /*
   * Generate SVG.
   */
  const svg =
    createStatsSvg(
      totalCommits,
      totalLines
    );

  fs.writeFileSync(
    OUTPUT_FILE,
    svg,
    "utf8"
  );

  console.log(
    "\n================================"
  );

  console.log(
    `📦 Total commits: ${formatNumber(
      totalCommits
    )}`
  );

  console.log(
    `📝 Total lines of code: ${formatNumber(
      totalLines
    )}`
  );

  console.log(
    `\n✓ Generated ${OUTPUT_FILE}`
  );

  console.log(
    "================================\n"
  );
}

main().catch((error) => {
  console.error(
    "\n❌ GitHub statistics generation failed:\n"
  );

  console.error(error);

  process.exit(1);
});
