import { createSystem, defaultConfig } from "@chakra-ui/react";

// ⚡️ Add your missing SectionColors export back here
export const SectionColors: Record<string, string> = {
  dashboard: "purple",
  library: "blue",
  playlists: "blue",
  shared: "pink",
  broadcast: "red",
  public: "teal",
  settings: "gray"
};

export const system = createSystem(defaultConfig, {
  theme: {
    semanticTokens: {
      colors: {
        bg: {
          value: { 
            _light: "{colors.gray.50}", 
            _dark: "{colors.gray.900}" // Much softer than pure black
          },
        },
        "bg.panel": {
          value: { 
            _light: "{colors.white}", 
            _dark: "{colors.gray.800}" 
          },
        },
        fg: {
          value: { 
            _light: "{colors.gray.900}", 
            _dark: "{colors.whiteAlpha.900}" 
          },
        },
        "fg.muted": {
          value: { 
            _light: "{colors.gray.500}", 
            _dark: "{colors.whiteAlpha.600}" 
          },
        },
        border: {
          value: { 
            _light: "{colors.gray.200}", 
            _dark: "{colors.whiteAlpha.200}" 
          },
        },
      },
    },
  },
});