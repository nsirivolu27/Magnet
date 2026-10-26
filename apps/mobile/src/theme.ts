// Magnet uses a neutral palette. Color never implies encryption or delivery status.
export const palettes = {
  dark: {
    bg: "#181818", surface: "#181818", raised: "#242424", selected: "#303030",
    line: "#3A3A3A", strong: "#555555", text: "#F5F5F5", muted: "#B8B8B8",
    subtle: "#949494", accent: "#F5F5F5", onAccent: "#181818",
    lineage: "#949494", live: "#F5F5F5", stop: "#F5F5F5",
  },
  light: {
    bg: "#FFFFFF", surface: "#FFFFFF", raised: "#F7F7F7", selected: "#EFEFEF",
    line: "#DEDEDE", strong: "#B0B0B0", text: "#171717", muted: "#5C5C5C",
    subtle: "#707070", accent: "#171717", onAccent: "#FFFFFF",
    lineage: "#707070", live: "#171717", stop: "#171717",
  },
};
export type Palette = typeof palettes.dark;
