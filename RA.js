const fs = require("fs");
const readline = require("readline");
const path = require("path");

const dataPath = path.join(__dirname, "data.js");
const recordsPath = path.join(__dirname, "recordsData.js");

// ===== Console Header =====
console.clear();
console.log("====================================");
console.log("🏆 RECORD ADDER");
console.log("====================================\n");

// ===== Load Games =====
const { gameList } = require(dataPath);

if (!Array.isArray(gameList)) {
    console.log("❌ gameList not found in data.js");
    process.exit();
}

// ===== Ensure records file exists =====
if (!fs.existsSync(recordsPath)) {
    fs.writeFileSync(recordsPath, "const records = [];\nmodule.exports = records;");
}

// ===== Helper to load records fresh =====
function loadRecords() {
    delete require.cache[require.resolve(recordsPath)];
    return require(recordsPath);
}

// ===== CLI Setup =====
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

// ===== Main Logic =====
(async function () {
    let records = loadRecords();

    console.log("Available Games:\n");
    gameList.forEach((g, i) => {
        console.log(`${i + 1}. ${g.name}`);
    });

    const gameInput = await ask("\nEnter Game Name OR Number: ");

    let game;

    // If number
    if (!isNaN(gameInput)) {
        const index = parseInt(gameInput) - 1;
        game = gameList[index];
    } else {
        game = gameList.find(g =>
            g.name.toLowerCase() === gameInput.toLowerCase()
        );
    }

    if (!game) {
        console.log("❌ Game not found.");
        rl.close();
        return;
    }

    const beatenBy = await ask("Who beat the record: ");
    const scoreInput = await ask("New Score: ");
    const score = parseFloat(scoreInput);

    if (isNaN(score)) {
        console.log("❌ Score must be a valid number.");
        rl.close();
        return;
    }

    const dateInput = await ask("Date beaten (leave blank for today): ");
    const date = dateInput || new Date().toISOString().split("T")[0];

    const proofInput = await ask("Proof file name (place file in \"Record Proofs\" folder, e.g. proof.mp4 or screenshot.png): ");
    const proof = proofInput.trim();

    let existing = records.find(r =>
        r.game.toLowerCase() === game.name.toLowerCase()
    );

    if (existing) {
        if (score <= existing.score) {
            console.log("\n❌ Score is not higher than existing record.");
            rl.close();
            return;
        }

        console.log("\n🔁 Updating existing record...");
        existing.score = score;
        existing.beatenBy = beatenBy;
        existing.date = date;
        existing.image = game.thumb || "";
        existing.proof = proof;
    } else {
        records.push({
            game: game.name,
            image: game.thumb || "",
            score,
            beatenBy,
            date,
            proof
        });
    }

    // ===== Save records safely =====
    fs.writeFileSync(
        recordsPath,
        "const records = " + JSON.stringify(records, null, 2) + ";\nmodule.exports = records;"
    );

    console.log("\n✅ Record saved successfully!");
    rl.close();
})();