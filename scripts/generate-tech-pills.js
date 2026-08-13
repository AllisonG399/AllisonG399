const fs = require("fs");
const path = require("path");
const techStack = require("./tech-stack");

const ICON_DIR = path.join(__dirname, "..", "assets", "icons");
const OUTPUT_DIR = path.join(__dirname, "..", "assets", "tech");

const COLORS = {
  background: "#D8C7AD",
  text: "#4C4C34",
};

const PILL_HEIGHT = 38;
const ICON_SIZE = 20;

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function estimateTextWidth(text) {
  return text.length * 7.2;
}

function createPill(technology) {
  const name = escapeXml(technology.name);

  const hasIcon = technology.icon && technology.icon.trim() !== "";

  let icon = "";

  if (hasIcon) {
    const iconPath = path.join(
      ICON_DIR,
      `${technology.icon}.svg`
    );

    if (!fs.existsSync(iconPath)) {
      console.warn(
        `⚠ Missing icon: ${technology.icon}.svg`
      );

      return;
    }

    icon = fs.readFileSync(iconPath, "utf8");
  }

  const textWidth = estimateTextWidth(technology.name);

  const horizontalPadding = 14;
  const iconGap = hasIcon ? 8 : 0;

  const width =
    horizontalPadding * 2 +
    (hasIcon ? ICON_SIZE : 0) +
    iconGap +
    textWidth;

  const textX =
    horizontalPadding +
    (hasIcon ? ICON_SIZE + iconGap : 0);

  const iconMarkup = hasIcon
    ? `
      <g transform="translate(${horizontalPadding}, 9)">
        ${icon
          .replace(
            /<svg[^>]*>/,
            `<svg
              width="${ICON_SIZE}"
              height="${ICON_SIZE}"
              viewBox="0 0 24 24"
            >`
          )
          .replace(/<\/svg>\s*$/, "</svg>")}
      </g>
    `
    : "";

  const svg = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${Math.ceil(width)}"
  height="${PILL_HEIGHT}"
  viewBox="0 0 ${Math.ceil(width)} ${PILL_HEIGHT}"
>
  <rect
    x="0"
    y="0"
    width="${Math.ceil(width)}"
    height="${PILL_HEIGHT}"
    rx="${PILL_HEIGHT / 2}"
    fill="${COLORS.background}"
  />

  ${iconMarkup}

  <text
    x="${textX}"
    y="24"
    fill="${COLORS.text}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="14"
    font-weight="600"
  >
    ${name}
  </text>
</svg>
`.trim();

  const outputPath = path.join(
    OUTPUT_DIR,
    `${technology.icon || technology.name
      .toLowerCase()
      .replace(/\s+/g, "-")}-pill.svg`
  );

  fs.writeFileSync(
    outputPath,
    svg,
    "utf8"
  );

  console.log(`✓ Generated ${technology.name}`);
}

function generateCategory(category, technologies) {
  console.log(`\n${category}`);

  for (const technology of technologies) {
    createPill(technology);
  }
}

fs.mkdirSync(OUTPUT_DIR, {
  recursive: true,
});

for (const [category, technologies] of Object.entries(
  techStack
)) {
  generateCategory(category, technologies);
}

console.log("\n✓ Tech pills generated.");
