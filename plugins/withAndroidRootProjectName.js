const { withSettingsGradle } = require("expo/config-plugins");

// Gradle project names can't start or end with a period, but the
// app's display name ("Squared.") does. Android's on-device label
// (android:label in AndroidManifest.xml) comes from expo.name and
// has no such restriction - only Gradle's internal rootProject.name
// does. This forces just that internal identifier to a safe value
// without touching the actual visible app name anywhere.
module.exports = function withAndroidRootProjectName(config) {
  return withSettingsGradle(config, (config) => {
    config.modResults.contents =
      config.modResults.contents.replace(
        /rootProject\.name\s*=\s*(['"]).*\1/,
        "rootProject.name = 'Squared'"
      );

    return config;
  });
};
