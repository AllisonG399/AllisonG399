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

async function getArtworkDataUri(track) {
  const images = track.image || [];

  const artwork =
    images.find((image) => image.size === "extralarge")?.["#text"] ||
    images.find((image) => image.size === "large")?.["#text"] ||
    images.find((image) => image.size === "medium")?.["#text"];

  if (!artwork) {
    console.log("No album artwork found.");
    return null;
  }

  console.log(`Downloading artwork: ${artwork}`);

  const response = await fetch(artwork);

  if (!response.ok) {
    console.log(`Artwork request failed: ${response.status}`);
    return null;
  }

  const contentType =
    response.headers.get("content-type") || "image/jpeg";

  const buffer = Buffer.from(await response.arrayBuffer());

  const base64 = buffer.toString("base64");

  return `data:${contentType};base64,${base64}`;
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

function createSvg(track, artworkDataUri) {
  const artist =
    typeof track.artist === "string"
      ? track.artist
      : track.artist?.["#text"] || "Unknown Artist";

  const title = track.name || "Unknown Track";
  const album = track.album?.["#text"] || "";

  const isPlaying = track["@attr"]?.nowplaying === "true";

  const status = isPlaying
    ? "● Listening now"
    : "✦ Recently played";

  const safeTitle = escapeXml(truncate(title, 34));
  const safeArtist = escapeXml(truncate(artist, 30));
  const safeAlbum = escapeXml(truncate(album, 32));
  const safeStatus = escapeXml(status);

  const artworkElement = artworkDataUri
    ? `
      <image
        href="${artworkDataUri}"
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

  <!-- Card background -->
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

  <!-- Inner surface -->
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

  <!-- Decorative botanical accent -->
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

</svg>
`;
}

async function main() {
  if (!apiKey) {
    throw new Error("LASTFM_API_KEY is not defined.");
  }

  console.log("Fetching Last.fm track...");

  const track = await getRecentTrack();

  const artist =
    typeof track.artist === "string"
      ? track.artist
      : track.artist?.["#text"];

  console.log(`Found: ${track.name} — ${artist}`);

  const artworkDataUri = await getArtworkDataUri(track);

  if (artworkDataUri) {
    console.log("✓ Album artwork embedded.");
  } else {
    console.log("⚠ No album artwork available.");
  }

  const svg = createSvg(track, artworkDataUri);

  fs.writeFileSync(
    "assets/currently-listening.svg",
    svg.trim()
  );

  console.log("✓ Updated assets/currently-listening.svg");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
