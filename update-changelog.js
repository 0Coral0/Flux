const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const DATA_FILE = path.join(__dirname, 'changelogData.js');

function ask(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

async function run() {
    console.log("--- Aggw Changelog Manager (Multi-line Support) ---");
    const v = await ask('1. Version (e.g. 1.0.0): ');
    const name = await ask('2. Version Name: ');
    const mini = await ask('3. Mini Desc: ');
    
    console.log('4. Large Desc (Paste your text below. Type "END" on a new line to finish):');
    
    let largeLines = [];
    rl.on('line', (line) => {
        if (line.trim() === 'END') {
            rl.removeAllListeners('line'); // Stop listening for lines
            saveData(v, name, mini, largeLines.join('\n'));
        } else {
            largeLines.push(line);
        }
    });
}

function saveData(v, name, mini, large) {
    let logs = [];
    
    // Check if file exists and read current data
    if (fs.existsSync(DATA_FILE)) {
        try {
            const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
            // Extract the JSON array from the file string
            const jsonPart = fileContent.substring(
                fileContent.indexOf('['),
                fileContent.lastIndexOf(']') + 1
            );
            logs = JSON.parse(jsonPart);
        } catch (e) {
            console.log("Creating new data file...");
            logs = [];
        }
    }

    // Add new entry to the start
    logs.unshift({ v, name, mini, large });

    // Format the file correctly for the browser to read
    const output = `const changelogData = ${JSON.stringify(logs, null, 4)};\n\nif (typeof module !== 'undefined') { module.exports = { changelogData }; }`;
    
    try {
        fs.writeFileSync(DATA_FILE, output, 'utf8');
        console.log(`\n✅ Success! Added v${v} to changelogData.js`);
    } catch (err) {
        console.error("❌ Failed to write file:", err);
    }
    
    rl.close();
}

run();