const https = require('https');
const { app, shell } = require('electron');

const CURRENT_VERSION = '1.0.0';
// Ganti dengan repository GitHub yang dituju (misal: 'owner/winnotch')
const GITHUB_REPO = 'winnotch/winnotch'; 

function checkGitHubUpdate() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      headers: {
        'User-Agent': 'WinNotch-Updater-1.0.0'
      }
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const release = JSON.parse(data);
            const latestTag = release.tag_name ? release.tag_name.replace(/^v/, '') : '';
            if (latestTag && latestTag !== CURRENT_VERSION) {
              return resolve({
                hasUpdate: true,
                version: release.tag_name,
                downloadUrl: release.html_url || release.assets?.[0]?.browser_download_url
              });
            }
          }
          resolve({ hasUpdate: false, version: CURRENT_VERSION });
        } catch {
          resolve({ hasUpdate: false, version: CURRENT_VERSION });
        }
      });
    });

    req.on('error', () => {
      resolve({ hasUpdate: false, version: CURRENT_VERSION });
    });

    req.setTimeout(4000, () => {
      req.destroy();
      resolve({ hasUpdate: false, version: CURRENT_VERSION });
    });
  });
}

function handleUpdateDownload(url) {
  if (url) {
    shell.openExternal(url);
  }
}

module.exports = {
  CURRENT_VERSION,
  checkGitHubUpdate,
  handleUpdateDownload
};
