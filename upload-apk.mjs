import fs from 'fs';
import path from 'path';
import axios from 'axios';

const token = process.env.GH_TOKEN;
const owner = 'safwantnd1-a11y';
const repo = 'restaurant-order-management-system';
const version = 'v1.0.1';
const fileName = 'Waiter_Panel_1.0.1b.apk';
const filePath = path.join(process.cwd(), 'release', 'Waiter Panel 1.0.1.apk');

async function upload() {
  try {
    console.log(`Fetching releases...`);
    const releaseRes = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/releases`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    const targetRelease = releaseRes.data.find(r => r.tag_name === version);
    if (!targetRelease) {
      throw new Error(`Release ${version} not found!`);
    }

    const releaseId = targetRelease.id;
    const uploadUrl = targetRelease.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(fileName)}`);

    console.log(`Uploading ${fileName} to release ${version}...`);
    const fileContent = fs.readFileSync(filePath);
    
    await axios.post(uploadUrl, fileContent, {
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': fileContent.length
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    console.log('APK uploaded successfully!');
  } catch (error) {
    console.error('Upload failed:', error.response ? error.response.data : error.message);
  }
}

upload();
