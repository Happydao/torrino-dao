const puppeteer = require('puppeteer');
const fs = require('fs');
const axios = require('axios');

// 🔹 Token GitHub e Gist ID
const GITHUB_TOKEN = process.env.G_TOKEN || require('dotenv').config().parsed.G_TOKEN;
const GIST_ID = "10f7efaf9403401bac666e86891d24b7";  
const FILE_NAME = "value.torrino.nft";  

// 🔹 Funzione per ottenere il valore della tesoreria da Step Finance
async function getTreasuryValue() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

    console.log("🔄 Apro Step Finance...");
    await page.goto('https://app.step.finance/en/dashboard?watching=EKjb5grMX19c3cAZa5LQjqksDpqqVLTGZrswh79WkPdD', {
        waitUntil: 'networkidle2',
        timeout: 90000
    });

    console.log("⏳ Aspetto il caricamento completo...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log("📥 Estrazione del valore...");
    const portfolioValue = await page.evaluate(() => {
        return document.title.split('|')[0].trim().replace('$', '').replace(' USD', '');
    });

    await browser.close();
    console.log(`✅ Valore della tesoreria estratto: $${portfolioValue}`);

    return parseFloat(portfolioValue.replace(/,/g, ''));
}

// 🔹 Funzione per ottenere il prezzo di SOL da CoinGecko
async function getSolPrice() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const solPrice = response.data.solana.usd;
        console.log(`🔹 Prezzo attuale di SOL: $${solPrice}`);
        return solPrice;
    } catch (error) {
        console.error("❌ Errore nel recupero del prezzo di SOL:", error);
        return null;
    }
}

// 🔹 Funzione per calcolare i valori NFT in USD e SOL
async function calculateNFTValues(treasuryValue) {
    if (isNaN(treasuryValue)) {
        throw new Error("❌ Errore: impossibile leggere il valore della tesoreria.");
    }

    const treasuryGen1 = treasuryValue * 0.90; // 90% per Gen 1
    const treasuryGen2 = treasuryValue * 0.10; // 10% per Gen 2

    const nftGen1Count = 500;
    const nftGen2Count = 888;

    const nftGen1Value = treasuryGen1 / nftGen1Count;
    const nftGen2Value = treasuryGen2 / nftGen2Count;

    const solPrice = await getSolPrice();
    const nftGen1ValueSol = solPrice ? (nftGen1Value / solPrice) : null;
    const nftGen2ValueSol = solPrice ? (nftGen2Value / solPrice) : null;

    return {
        treasuryValue,
        treasuryGen1,
        treasuryGen2,
        nftGen1Value,
        nftGen2Value,
        solPrice,
        nftGen1ValueSol,
        nftGen2ValueSol
    };
}

// 🔹 Funzione per aggiornare il Gist su GitHub
async function updateGist(data) {
    const now = new Date();
    const formattedDate = now.toLocaleString("it-IT", { timeZone: "Europe/Rome" });

    const output = `
🕒 Ultimo aggiornamento: ${formattedDate}

📊 Valori calcolati:
💰 Tesoreria Totale: $${data.treasuryValue.toFixed(2)}
🔹 Gen 1 Tesoreria (90%): $${data.treasuryGen1.toFixed(2)}
🔸 Gen 2 Tesoreria (10%): $${data.treasuryGen2.toFixed(2)}
🔹 Prezzo SOL attuale: $${data.solPrice.toFixed(2)}

🖼️ Valore NFT Gen 1 (500 NFT): $${data.nftGen1Value.toFixed(2)} (${data.nftGen1ValueSol ? data.nftGen1ValueSol.toFixed(2) : 'Errore'} SOL)
🖼️ Valore NFT Gen 2 (888 NFT): $${data.nftGen2Value.toFixed(2)} (${data.nftGen2ValueSol ? data.nftGen2ValueSol.toFixed(2) : 'Errore'} SOL)
    `;

    console.log("📤 Aggiorno il Gist su GitHub...");

    const response = await axios.patch(
        `https://api.github.com/gists/${GIST_ID}`,
        {
            files: {
                [FILE_NAME]: { content: output.trim() }
            }
        },
        {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                Accept: "application/vnd.github.v3+json"
            }
        }
    );

    if (response.status === 200) {
        console.log("✅ Valore aggiornato su GitHub Gist:", `https://gist.githubusercontent.com/Happydao/${GIST_ID}/raw/${FILE_NAME}`);
    } else {
        console.log("❌ Errore aggiornamento Gist:", response.data);
    }
}

// 🔹 Funzione principale
async function main() {
    try {
        const treasuryValue = await getTreasuryValue();
        const nftData = await calculateNFTValues(treasuryValue);

        fs.writeFileSync(FILE_NAME, JSON.stringify(nftData, null, 2));
        console.log(`✅ Dati salvati in \`${FILE_NAME}\`.`);

        await updateGist(nftData);
    } catch (error) {
        console.error("❌ Errore generale:", error);
    }
}

// 🔹 Esegui lo script
main().then(() => process.exit(0)).catch(error => {
    console.error("❌ Errore generale:", error);
    process.exit(1);
});
