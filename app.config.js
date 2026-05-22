const fs = require('fs');
const path = require('path');

const appJson = require('./app.json');

function readLocalEnv(name) {
  const envPath = path.join(__dirname, 'backend', '.env');
  if (!fs.existsSync(envPath)) return undefined;

  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${name}=`));

  return line?.split('=').slice(1).join('=').trim();
}

module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_API_KEY || readLocalEnv('GOOGLE_API_KEY');
  const baseConfig = {
    ...appJson.expo,
    ...config,
  };

  return {
    ...baseConfig,
    android: {
      ...baseConfig.android,
      config: {
        ...baseConfig.android?.config,
        googleMaps: googleMapsApiKey
          ? {
              apiKey: googleMapsApiKey,
            }
          : baseConfig.android?.config?.googleMaps,
      },
    },
  };
};
