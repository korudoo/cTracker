#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_IMAGE="${ROOT_DIR}/cTrackerLogo.png"
ICONS_DIR="${ROOT_DIR}/public/icons"
MASKABLE_TMP="/tmp/ctracker-maskable-base.png"

if [[ ! -f "${SOURCE_IMAGE}" ]]; then
  echo "Missing source image: ${SOURCE_IMAGE}" >&2
  exit 1
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "sips is required to generate icons." >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required to generate favicon.ico." >&2
  exit 1
fi

mkdir -p "${ICONS_DIR}"
cp "${SOURCE_IMAGE}" "${ICONS_DIR}/logo-source.png"

sips -z 16 16 "${SOURCE_IMAGE}" --out "${ICONS_DIR}/favicon-16x16.png" >/dev/null
sips -z 32 32 "${SOURCE_IMAGE}" --out "${ICONS_DIR}/favicon-32x32.png" >/dev/null
sips -z 48 48 "${SOURCE_IMAGE}" --out "${ICONS_DIR}/favicon-48x48.png" >/dev/null
sips -z 180 180 "${SOURCE_IMAGE}" --out "${ICONS_DIR}/apple-touch-icon.png" >/dev/null
sips -z 192 192 "${SOURCE_IMAGE}" --out "${ICONS_DIR}/icon-192.png" >/dev/null
sips -z 512 512 "${SOURCE_IMAGE}" --out "${ICONS_DIR}/icon-512.png" >/dev/null

# Maskable icon keeps safe padding so key logo content avoids device mask clipping.
sips -z 410 410 "${SOURCE_IMAGE}" --out "${MASKABLE_TMP}" >/dev/null
sips -p 512 512 "${MASKABLE_TMP}" --padColor FFFFFF --out "${ICONS_DIR}/maskable-icon-512.png" >/dev/null
rm -f "${MASKABLE_TMP}"

ffmpeg -loglevel error -y -i "${SOURCE_IMAGE}" -vf scale=32:32 "${ICONS_DIR}/favicon.ico"

# Root-level fallbacks used by some browsers/OS launchers.
cp "${ICONS_DIR}/favicon.ico" "${ROOT_DIR}/public/favicon.ico"
cp "${ICONS_DIR}/apple-touch-icon.png" "${ROOT_DIR}/public/apple-touch-icon.png"

echo "Generated icons in ${ICONS_DIR}"
