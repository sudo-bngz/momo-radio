import { createSystem, defaultConfig } from "@chakra-ui/react";

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
            // Exact neutral off-black from the reference image
            _dark: "#111111" 
          },
        },
        "bg.panel": {
          value: { 
            _light: "{colors.white}", 
            // Slightly lighter neutral gray to make cards/menus pop subtly
            _dark: "#1A1A1A" 
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
            // Soft translucent border to separate panels cleanly
            _dark: "{colors.whiteAlpha.100}" 
          },
        },
      },
    },
  },
});