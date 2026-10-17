const fs = require('fs');
const path = require('path');
const readline = require('readline');

const FILE_PATH = path.join(__dirname, 'data.js');

const BRAND_HEADER = `
\x1b[34m      ####################################
\x1b[34m      ##                                ##
\x1b[34m      ##      \x1b[37m  █▀▀█ █▀▀█ █▀▀█ █   █  \x1b[34m      ##
\x1b[34m      ##      \x1b[37m  █▄▄█ █ ▄▄ █ ▄▄ █ █ █  \x1b[34m      ##
\x1b[34m      ##      \x1b[37m  █  █ █▄▄█ █▄▄█ █▄▀▄█  \x1b[34m      ##
\x1b[34m      ##                                ##
\x1b[34m      ##         \x1b[37mGAME ADMIN v4.0\x1b[34m         ##
\x1b[34m      ####################################\x1b[0m
`;

// --- DATA ENGINE ---
function getGames() {
    try {
        if (!fs.existsSync(FILE_PATH)) return [];

        delete require.cache[require.resolve(FILE_PATH)];
        const fileContent = fs.readFileSync(FILE_PATH, 'utf8');

        const match = fileContent.match(/const gameList = ([\s\S]*?);/);
        return match ? JSON.parse(match[1]) : [];

    } catch (err) {
        console.error("\x1b[31m%s\x1b[0m", "Read Error: " + err.message);
        return [];
    }
}

function saveGames(games) {
    if (games.length === 0 && fs.existsSync(FILE_PATH)) {
        console.log("\x1b[41m%s\x1b[0m", " !! ABORTED: DATA LOSS PROTECTION !! ");
        process.exit(1);
    }

    const output = `const gameList = ${JSON.stringify(games, null, 4)};

if (typeof module !== 'undefined') {
    module.exports = { gameList };
}`;

    fs.writeFileSync(FILE_PATH, output, 'utf8');
}

// --- DELETE LOGIC ---
const args = process.argv.slice(2);

if (args[0] === 'delete') {
    const target = args.slice(1).join(' ');
    let games = getGames();

    const newGames = games.filter(g =>
        g.name.toLowerCase() !== target.toLowerCase()
    );

    if (newGames.length < games.length) {
        saveGames(newGames);
        console.log("\x1b[32m%s\x1b[0m", `Removed '${target}'`);
    } else {
        console.log("\x1b[33m%s\x1b[0m", `'${target}' not found.`);
    }

    process.exit();
}

// --- ADD LOGIC ---
console.clear();
console.log(BRAND_HEADER);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
});

rl.question('\x1b[36mName: \x1b[0m', (name) => {
    rl.question('\x1b[37mHTML File: \x1b[0m', (file) => {
        rl.question('\x1b[37mThumbnail: \x1b[0m', (thumb) => {

            let games = getGames();
            const newItem = { name, file, thumb };

            games.push(newItem);
            saveGames(games);

            console.log("\x1b[32m%s\x1b[0m", "\nSUCCESS: Game added.");
            console.log(`Total Games: ${games.length}`);

            rl.close();
        });
    });
});