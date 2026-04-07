import ngrok from 'ngrok';
import fs from 'fs';

async function start() {
    try {
        await ngrok.kill(); // Kill any existing instances first
        
        const url = await ngrok.connect({
            addr: 3000,
            authtoken: '3ByFipnAWgi0hF626GQ3HWxTRlG_5XpZSpt4un4ixKBY4noU4'
        });
        
        fs.writeFileSync('ngrok_url.txt', url);
        console.log("URL generated: " + url);
        
        // Keep process alive so tunnel stays open
        setInterval(() => {}, 1000 * 60 * 60); 
    } catch (err) {
        fs.writeFileSync('ngrok_url.txt', 'ERROR: ' + err.message);
        console.error(err);
    }
}

start();
