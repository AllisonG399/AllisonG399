const fs = require("fs");
const path = require("path");
const techStack = require("./tech-stack");

const ICON_DIR = path.join(
  __dirname,
  "..",
  "assets",
  "icons"
);

const OUTPUT_DIR = path.join(
  __dirname,
  "..",
  "assets",
  "tech"
);

const COLORS = {
  background: "#FDFBF9",
  text: "#743014",
};

const PILL_HEIGHT = 32;
const ICON_SIZE = 18;
const FONT_SIZE = 12;

const HORIZONTAL_PADDING = 14;
const ICON_GAP = 7;
const TEXT_BUFFER = 4;

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/*
 * SVG text does not have an easy way to calculate its
 * rendered width in Node without a browser/canvas.
 *
 * This provides a conservative estimate so text has
 * enough room inside the pill.
 */
function estimateTextWidth(text) {
  return text.length * 6.8;
}

/*
 * Extract the original viewBox from the technology icon.
 *
 * Different SVG icons use different coordinate systems,
 * so we should NOT force every icon into 0 0 24 24.
 */
function extractViewBox(svg) {
  const match = svg.match(
    /viewBox=["']([^"']+)["']/i
  );

  if (!match) {
    return "0 0 24 24";
  }

  return match[1];
}

/*
 * Remove the outer <svg> wrapper so the icon can be
 * placed inside our own SVG container.
 */
function extractSvgContent(svg) {
  return svg
    .replace(/<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
}

function createPill(technology) {
  const name = escapeXml(
    technology.name
  );

  /*
   * Technologies with icon: ""
   * intentionally become text-only pills.
   */
  const hasIcon =
    technology.icon &&
    technology.icon.trim() !== "";

  let iconMarkup = "";

  /*
   * ----------------------------------------
   * ICON
   * ----------------------------------------
   */

  if (hasIcon) {
    const iconPath = path.join(
      ICON_DIR,
      `${technology.icon}.svg`
    );

    /*
     * If an icon is specified but the file
     * doesn't exist, warn and skip it.
     */
    if (!fs.existsSync(iconPath)) {
      console.warn(
        `⚠ Missing icon: ${technology.icon}.svg`
      );

      return;
    }

    const iconSvg = fs.readFileSync(
      iconPath,
      "utf8"
    );

    /*
     * Preserve the icon's original coordinate
     * system so artwork doesn't become clipped.
     */
    const viewBox =
      extractViewBox(iconSvg);

    const content =
      extractSvgContent(iconSvg);

    iconMarkup = `
      <svg
        x="${HORIZONTAL_PADDING}"
        y="${(PILL_HEIGHT - ICON_SIZE) / 2}"
        width="${ICON_SIZE}"
        height="${ICON_SIZE}"
        viewBox="${viewBox}"
        preserveAspectRatio="xMidYMid meet"
      >
        ${content}
      </svg>
    `;
  }

  /*
   * ----------------------------------------
   * TEXT / WIDTH
   * ----------------------------------------
   */

  const textWidth =
    estimateTextWidth(
      technology.name
    );

  /*
   * Icon contributes its width plus the
   * spacing between the icon and text.
   *
   * Text-only pills receive none of this.
   */
  const iconWidth = hasIcon
    ? ICON_SIZE + ICON_GAP
    : 0;

  /*
   * Calculate the pill width based on:
   *
   * left padding
   * + icon
   * + icon/text gap
   * + text
   * + safety buffer
   * + right padding
   */
  const width =
    HORIZONTAL_PADDING * 2 +
    iconWidth +
    textWidth +
    TEXT_BUFFER;

  const roundedWidth =
    Math.ceil(width);

  /*
   * Text begins after the icon when one exists.
   */
  const textX =
    HORIZONTAL_PADDING +
    iconWidth;

  /*
   * ----------------------------------------
   * SVG
   * ----------------------------------------
   */

  const svg = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${roundedWidth}"
  height="${PILL_HEIGHT}"
  viewBox="0 0 ${roundedWidth} ${PILL_HEIGHT}"
>
  <rect
    x="0"
    y="0"
    width="${roundedWidth}"
    height="${PILL_HEIGHT}"
    rx="${PILL_HEIGHT / 2}"
    fill="${COLORS.background}"
  />

  ${iconMarkup}

  <text
    x="${textX}"
    y="${PILL_HEIGHT / 2 + FONT_SIZE * 0.35}"
    fill="${COLORS.text}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="${FONT_SIZE}"
    font-weight="600"
  >
    ${name}
  </text>
</svg>
`.trim();

  /*
   * ----------------------------------------
   * OUTPUT FILE
   * ----------------------------------------
   */

  const filename = (
    technology.icon ||
    technology.name
  )
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/\./g, "");

  const outputPath = path.join(
    OUTPUT_DIR,
    `${filename}-pill.svg`
  );

  fs.writeFileSync(
    outputPath,
    svg,
    "utf8"
  );

  console.log(
    `✓ Generated ${technology.name}`
  );
}

/*
 * ----------------------------------------
 * CATEGORY GENERATION
 * ----------------------------------------
 */

function generateCategory(
  category,
  technologies
) {
  console.log(`\n${category}`);

  for (const technology of technologies) {
    createPill(technology);
  }
}

/*
 * Make sure the output directory exists.
 */
fs.mkdirSync(
  OUTPUT_DIR,
  {
    recursive: true,
  }
);

/*
 * Generate pills for every category
 * in tech-stack.js.
 */
for (const [
  category,
  technologies,
] of Object.entries(
  techStack
)) {
  generateCategory(
    category,
    technologies
  );
}

console.log(
  "\n✓ Tech pills generated."
);
