const fs = require("fs");

const username = "Allison399";
const apiKey = process.env.LASTFM_API_KEY;

const COLORS = {
  background: "#f9f5f1",
  text: "#413933",
  muted: "#756F6C",
  surface: "#fdfbf9",
  border: "#dcc9b0",
  highlight: "#743014",
  hover: "#b5b18f",
  dark: "#442d1c",
  accent: "#4c4c34",
};

async function getRecentTrack() {
  const url =
    `https://ws.audioscrobbler.com/2.0/` +
    `?method=user.getRecentTracks` +
    `&user=${encodeURIComponent(username)}` +
    `&api_key=${apiKey}` +
    `&format=json` +
    `&limit=1`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Last.fm request failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Last.fm error: ${data.message}`);
  }

  const track = data.recenttracks?.track?.[0];

  if (!track) {
    throw new Error("No recent Last.fm track found.");
  }

  return track;
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - 3) + "...";
}

function createSvg(track) {
  const artist =
    typeof track.artist === "string"
      ? track.artist
      : track.artist?.["#text"] || "Unknown Artist";

  const title = track.name || "Unknown Track";
  const album = track.album?.["#text"] || "";

  const artwork =
    track.image?.find((image) => image.size === "extralarge")?.["#text"] ||
    track.image?.find((image) => image.size === "large")?.["#text"] ||
    "";

  const isPlaying = track["@attr"]?.nowplaying === "true";

  const status = isPlaying
    ? "● Listening now"
    : "✦ Recently played";

  const safeTitle = escapeXml(truncate(title, 34));
  const safeArtist = escapeXml(truncate(artist, 30));
  const safeAlbum = escapeXml(truncate(album, 32));
  const safeStatus = escapeXml(status);

  const artworkElement = artwork
    ? `
      <image
        href="${escapeXml(artwork)}"
        x="50"
        y="50"
        width="220"
        height="220"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#albumClip)"
      />
    `
    : `
      <rect
        x="50"
        y="50"
        width="220"
        height="220"
        rx="18"
        fill="${COLORS.hover}"
      />

      <text
        x="160"
        y="175"
        text-anchor="middle"
        font-family="Georgia, serif"
        font-size="48"
        fill="${COLORS.surface}"
      >
        ♫
      </text>
    `;

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="900"
  height="330"
  viewBox="0 0 900 330"
>
  <defs>
    <clipPath id="albumClip">
      <rect
        x="50"
        y="50"
        width="220"
        height="220"
        rx="18"
      />
    </clipPath>
  </defs>

  <!-- Card -->
  <rect
    x="4"
    y="4"
    width="892"
    height="322"
    rx="28"
    fill="${COLORS.background}"
    stroke="${COLORS.border}"
    stroke-width="3"
  />

  <!-- Subtle inner surface -->
  <rect
    x="24"
    y="24"
    width="852"
    height="282"
    rx="20"
    fill="${COLORS.surface}"
  />

  <!-- Album artwork -->
  ${artworkElement}

  <!-- Divider -->
  <line
    x1="305"
    y1="55"
    x2="305"
    y2="275"
    stroke="${COLORS.border}"
    stroke-width="2"
  />

  <!-- Heading -->
  <text
    x="345"
    y="82"
    font-family="Arial, Helvetica, sans-serif"
    font-size="18"
    font-weight="700"
    letter-spacing="2"
    fill="${COLORS.accent}"
  >
    ♫ CURRENTLY LISTENING
  </text>

  <!-- Song -->
  <text
    x="345"
    y="145"
    font-family="Georgia, serif"
    font-size="31"
    font-weight="700"
    fill="${COLORS.text}"
  >
    ${safeTitle}
  </text>

  <!-- Artist -->
  <text
    x="345"
    y="180"
    font-family="Arial, Helvetica, sans-serif"
    font-size="20"
    fill="${COLORS.highlight}"
  >
    ${safeArtist}
  </text>

  <!-- Album -->
  ${
    safeAlbum
      ? `
  <text
    x="345"
    y="210"
    font-family="Arial, Helvetica, sans-serif"
    font-size="15"
    fill="${COLORS.muted}"
  >
    ${safeAlbum}
  </text>
  `
      : ""
  }

  <!-- Status -->
  <text
    x="345"
    y="252"
    font-family="Arial, Helvetica, sans-serif"
    font-size="14"
    font-weight="600"
    fill="${COLORS.accent}"
  >
    ${safeStatus}
  </text>

  <!-- AG watermark -->
  <text
    x="830"
    y="285"
    text-anchor="middle"
    font-family="Georgia, serif"
    font-size="26"
    font-style="italic"
    font-weight="700"
    fill="${COLORS.hover}"
    opacity="0.65"
  >
    AG
  </text>

  <!-- Decorative botanical element -->
  <text
    x="830"
    y="70"
    text-anchor="middle"
    font-size="25"
    fill="${COLORS.accent}"
    opacity="0.55"
  >
    ✦
  </text>

</svg>
`;
}

async function main() {
  if (!apiKey) {
    throw new Error("LASTFM_API_KEY is not defined.");
  }

  console.log("Fetching Last.fm track...");

  const track = await getRecentTrack();

  console.log(
    `Found: ${track.name} — ${
      typeof track.artist === "string"
        ? track.artist
        : track.artist?.["#text"]
    }`
  );

  const svg = createSvg(track);

  fs.writeFileSync(
    "assets/currently-listening.svg",
    svg.trim()
  );

  console.log("Updated assets/currently-listening.svg");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
