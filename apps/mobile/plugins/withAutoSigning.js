const { withXcodeProject } = require("@expo/config-plugins");

module.exports = function withAutoSigning(config) {
  return withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key].buildSettings;
      if (buildSettings && buildSettings.PRODUCT_NAME === '"Barkly"') {
        buildSettings.CODE_SIGN_STYLE = "Automatic";
      }
    }
    return modConfig;
  });
};
