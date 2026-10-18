import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    server: {
      deps: {
        inline: [/expo-.*/, /@expo\/.*/, /react-native/]
      }
    }
  },
  resolve: {
    alias: {
      "react-native": "react-native-web",
      "expo-secure-store": path.resolve(__dirname, "./tests/mocks/expo-secure-store.ts"),
      "expo-constants": path.resolve(__dirname, "./tests/mocks/expo-constants.ts"),
    }
  }
});
