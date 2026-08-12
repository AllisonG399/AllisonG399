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

// --------------------------------------------------
// Last.fm API
// --------------------------------------------------

async function getRecentTracks() {
  const url =
    `https://ws.audioscrobbler.com/2.0/` +
    `?method=user.getRecentTracks` +
    `&user=${encodeURIComponent(username)}` +
    `&api_key=${apiKey}` +
    `&format=json` +
    `&limit=6`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Last.fm request failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Last.fm error: ${data.message}`);
  }

  const tracks = data.recenttracks?.track || [];

  if (tracks.length === 0) {
    throw new Error("No recent Last.fm tracks found.");
  }

  return tracks;
}

// --------------------------------------------------
// Album Artwork
// --------------------------------------------------

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

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeAttribute(value = "") {
  return escapeXml(value);
}

function truncate(text, maxLength) {
  if (!text) {
    return "";
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - 3) + "...";
}

function getArtist(track) {
  return typeof track.artist === "string"
    ? track.artist
    : track.artist?.["#text"] || "Unknown Artist";
}

// --------------------------------------------------
// Recent Track Rows
// --------------------------------------------------

function createRecentTrackRows(recentTracks) {
  return recentTracks
    .map((track, index) => {
      const title = truncate(track.name || "Unknown Track", 34);
      const artist = truncate(getArtist(track), 25);

      const safeTitle = escapeXml(title);
      const safeArtist = escapeXml(artist);

      const number = String(index + 1).padStart(2, "0");

      // SVG links require the actual Last.fm URL
      const trackUrl = track.url || `https://www.last.fm/user/${username}`;

      const safeUrl = escapeAttribute(trackUrl);

      const y = 395 + index * 39;

      return `
        <!-- Recent track ${index + 1} -->

        <a
          href="${safeUrl}"
          target="_blank"
        >

          <text
            x="70"
            y="${y}"
            font-family="Arial, Helvetica, sans-serif"
            font-size="13"
            font-weight="700"
            fill="${COLORS.accent}"
          >
            ${number}
          </text>

          <text
            x="110"
            y="${y}"
            font-family="Arial, Helvetica, sans-serif"
            font-size="14"
            font-weight="600"
            fill="${COLORS.text}"
          >
            ${safeTitle}
          </text>

          <text
            x="500"
            y="${y}"
            font-family="Arial, Helvetica, sans-serif"
            font-size="14"
            fill="${COLORS.muted}"
          >
            ${safeArtist}
          </text>

        </a>

        <line
          x1="70"
          y1="${y + 14}"
          x2="830"
          y2="${y + 14}"
          stroke="${COLORS.border}"
          stroke-width="1"
          opacity="0.65"
        />
      `;
    })
    .join("");
}

// --------------------------------------------------
// SVG
// --------------------------------------------------

function createSvg(track, artworkDataUri, recentTracks) {
  const artist = getArtist(track);

  const title = track.name || "Unknown Track";

  const album = track.album?.["#text"] || "";

  const isPlaying =
    track["@attr"]?.nowplaying === "true";

  const status = isPlaying
    ? "● Listening now"
    : "✦ Recently played";

  const safeTitle =
    escapeXml(truncate(title, 34));

  const safeArtist =
    escapeXml(truncate(artist, 30));

  const safeAlbum =
    escapeXml(truncate(album, 32));

  const safeStatus =
    escapeXml(status);

  const artworkElement = artworkDataUri
    ? `
      <image
        href="${artworkDataUri}"
        x="55"
        y="55"
        width="220"
        height="220"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#albumClip)"
      />
    `
    : `
      <rect
        x="55"
        y="55"
        width="220"
        height="220"
        rx="18"
        fill="${COLORS.hover}"
      />

      <text
        x="165"
        y="180"
        text-anchor="middle"
        font-family="Georgia, serif"
        font-size="48"
        fill="${COLORS.surface}"
      >
        ♫
      </text>
    `;

  const recentRows =
    createRecentTrackRows(recentTracks);

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="900"
  height="620"
  viewBox="0 0 900 620"
>

  <defs>

    <!-- Rounded album artwork -->
    <clipPath id="albumClip">
      <rect
        x="55"
        y="55"
        width="220"
        height="220"
        rx="18"
      />
    </clipPath>

  </defs>


  <!-- ========================================= -->
  <!-- Main Card -->
  <!-- ========================================= -->

  <rect
    x="4"
    y="4"
    width="892"
    height="612"
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
    height="572"
    rx="20"
    fill="${COLORS.surface}"
  />


  <!-- ========================================= -->
  <!-- Album Artwork -->
  <!-- ========================================= -->

  ${artworkElement}


  <!-- ========================================= -->
  <!-- Vertical Divider -->
  <!-- ========================================= -->

  <line
    x1="310"
    y1="55"
    x2="310"
    y2="275"
    stroke="${COLORS.border}"
    stroke-width="2"
  />


  <!-- ========================================= -->
  <!-- Current Track -->
  <!-- ========================================= -->

  <text
    x="350"
    y="82"
    font-family="Arial, Helvetica, sans-serif"
    font-size="17"
    font-weight="700"
    letter-spacing="2"
    fill="${COLORS.accent}"
  >
    ♫ CURRENTLY LISTENING
  </text>


  <!-- Song title -->

  <text
    x="350"
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
    x="350"
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
          x="350"
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
    x="350"
    y="252"
    font-family="Arial, Helvetica, sans-serif"
    font-size="14"
    font-weight="600"
    fill="${COLORS.accent}"
  >
    ${safeStatus}
  </text>


  <!-- ========================================= -->
  <!-- Decorative Elements -->
  <!-- ========================================= -->

  <text
    x="830"
    y="72"
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
    y="275"
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


  <!-- ========================================= -->
  <!-- Divider -->
  <!-- ========================================= -->

  <line
    x1="70"
    y1="315"
    x2="830"
    y2="315"
    stroke="${COLORS.border}"
    stroke-width="2"
  />


  <!-- ========================================= -->
  <!-- Recent Tracks Heading -->
  <!-- ========================================= -->

  <text
    x="70"
    y="355"
    font-family="Arial, Helvetica, sans-serif"
    font-size="16"
    font-weight="700"
    letter-spacing="1.5"
    fill="${COLORS.accent}"
  >
    ♫ RECENTLY PLAYED
  </text>


  <!-- Recent tracks -->

  ${recentRows}


  <!-- ========================================= -->
  <!-- Bottom Decorative Accent -->
  <!-- ========================================= -->

  <text
    x="830"
    y="575"
    text-anchor="middle"
    font-family="Georgia, serif"
    font-size="18"
    fill="${COLORS.hover}"
    opacity="0.55"
  >
    ✦
  </text>

</svg>
`;
}

// --------------------------------------------------
// Main
// --------------------------------------------------

async function main() {
  if (!apiKey) {
    throw new Error(
      "LASTFM_API_KEY is not defined."
    );
  }

  console.log(
    "Fetching recent Last.fm tracks..."
  );

  const tracks =
    await getRecentTracks();


  // Find the track currently playing.

  const nowPlaying =
    tracks.find(
      (track) =>
        track["@attr"]?.nowplaying === "true"
    ) || null;


  // If nothing is currently playing,
  // use the most recent track for the
  // main card.

  const mainTrack =
    nowPlaying || tracks[0];


  // Build the recent list.

  const recentTracks = tracks
    .filter(
      (track) =>
        track !== nowPlaying
    )
    .slice(0, 5);


  const artist =
    getArtist(mainTrack);


  console.log(
    `Now playing / latest: ${mainTrack.name} — ${artist}`
  );


  console.log(
    `Recent tracks: ${recentTracks.length}`
  );


  // Download and embed artwork.

  const artworkDataUri =
    await getArtworkDataUri(
      mainTrack
    );


  if (artworkDataUri) {
    console.log(
      "✓ Album artwork embedded."
    );
  } else {
    console.log(
      "⚠ No album artwork available."
    );
  }


  // Generate SVG.

  const svg =
    createSvg(
      mainTrack,
      artworkDataUri,
      recentTracks
    );


  fs.writeFileSync(
    "assets/currently-listening.svg",
    svg.trim()
  );


  console.log(
    "✓ Updated assets/currently-listening.svg"
  );
}


main().catch((error) => {
  console.error(error);
  process.exit(1);
});
