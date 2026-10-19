import { spawn } from 'node:child_process';
import { access, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';

const root = dirname(fileURLToPath(import.meta.url));
const repo = join(root, '..');
const binary = join(repo, 'proxy', '.tools', 'cloudflared.exe');
const port = Number(process.env.PORT || 3032);
const required = ['DISCORD_BOT_TOKEN','DISCORD_GUILD_ID','FIREBASE_PROJECT_ID','BRIDGE_FIRESTORE_DATABASE','GOOGLE_APPLICATION_CREDENTIALS','FLUX_SITE_ORIGIN'];
const missing = required.filter(key => !process.env[key] || process.env[key].includes('your-'));
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try { await access(process.env.GOOGLE_APPLICATION_CREDENTIALS); }
  catch { if (!missing.includes('GOOGLE_APPLICATION_CREDENTIALS')) missing.push('GOOGLE_APPLICATION_CREDENTIALS'); }
}
if (!Number.isInteger(port) || port < 1 || port > 65535) missing.push('PORT');
if (missing.length) {
  console.error('Finish these settings in discord-bridge/.env: ' + missing.join(', '));
  console.error('The bot token and the Firebase private key stay on this PC. See discord-bridge/README.md.');
  process.exitCode = 1;
} else {
  await access(binary).catch(() => { throw Error('Cloudflare tunnel tool is missing. Install it at proxy/.tools/cloudflared.exe before starting.'); });
  await readFile(join(root, 'node_modules/discord.js/package.json'));
  if (process.argv.includes('--check')) console.log('PC settings and dependencies are present. Live credentials have not been tested.');
  else await launch();
}

async function launch() {
  const inUse = await new Promise(resolve => {
    const socket = createConnection({ host:'127.0.0.1',port });
    socket.once('connect',()=>{socket.destroy();resolve(true);});
    socket.once('error',()=>resolve(false));
  });
  if (inUse) throw Error('The community service port is already in use. Close the existing community launcher first.');
  const children = [];
  let stopping = false;
  const stop = () => { if (stopping) return; stopping = true; for (const child of children) child.kill(); };
  process.once('SIGINT',stop); process.once('SIGTERM',stop); process.once('exit',stop);
  function child(command,args,options={}) {
    const processChild = spawn(command,args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],...options});
    children.push(processChild);
    processChild.on('error',error=>{console.error(error.message);stop();process.exitCode=1;});
    processChild.once('exit',()=>{if(!stopping){console.error('A community service process stopped. Restart the launcher.');stop();process.exitCode=1;}});
    return processChild;
  }
  try {
    const tunnel = child(binary,['tunnel','--url','http://127.0.0.1:'+port,'--no-autoupdate']);
    const publicUrl = await new Promise((resolve,reject)=>{
      let output = '';
      const timeout = setTimeout(()=>reject(Error('The HTTPS tunnel did not become ready.')),60000);
      const inspect = chunk=>{
        output = (output + chunk.toString()).slice(-16000);
        const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if(match){clearTimeout(timeout);resolve(match[0]);}
      };
      tunnel.stdout.on('data',inspect);tunnel.stderr.on('data',inspect);
      tunnel.once('error',error=>{clearTimeout(timeout);reject(error);});
      tunnel.once('exit',()=>{clearTimeout(timeout);reject(Error('The HTTPS tunnel exited before startup.'));});
    });
    const backend = child(process.execPath,['server.mjs'],{env:{...process.env,BRIDGE_PUBLIC_URL:publicUrl,FLUX_LOCAL_ORIGIN:'http://127.0.0.1:3031'}});
    backend.stdout.on('data',chunk=>process.stdout.write(chunk));backend.stderr.on('data',chunk=>process.stderr.write(chunk));
    let ready = false;
    for(let attempt=0;attempt<60 && !stopping;attempt++) {
      try { ready = (await fetch('http://127.0.0.1:'+port+'/healthz',{signal:AbortSignal.timeout(500)})).ok; }
      catch { /* Bot and Firebase connection are still starting. */ }
      if(ready)break;
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    if(!ready)throw Error('The community service could not start. Check the private settings and bot permissions.');
    const config = '// Updated by the PC community launcher. No secrets belong here.\nwindow.FLUX_DISCORD_BRIDGE_URL = ' + JSON.stringify(publicUrl) + ';\n';
    await writeFile(join(repo,'js/discord-config.js'),config);
    let siteRunning = false;
    try {
      const response = await fetch('http://127.0.0.1:3031/',{signal:AbortSignal.timeout(1000)});
      siteRunning = response.ok && (await response.text()).includes('<title>Flux');
      if(!siteRunning)throw Error('Port 3031 is being used by another website.');
    } catch(error) {
      if(error.message.includes('another website'))throw error;
    }
    if(!siteRunning) {
      const site = child(process.execPath,[join(repo,'proxy/serve-flux.mjs')]);
      site.stdout.on('data',chunk=>process.stdout.write(chunk));site.stderr.on('data',chunk=>process.stderr.write(chunk));
    }
    console.log('Open Flux on this PC: http://127.0.0.1:3031/');
    console.log('Discord service HTTPS address: '+publicUrl);
    console.log('Keep this launcher running. The HTTPS address changes after restarting.');
    console.log('The hosted website needs the updated site files and js/discord-config.js published before it can connect.');
  } catch(error) { stop();throw error; }
}
