const puppeteer = require('puppeteer');
const fs = require('fs');
const axios = require('axios');

// 🔹 Token GitHub e Gist ID
const GITHUB_TOKEN = process.env.G_TOKEN; // Usa il token GitHub dai segreti
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

// 🔹 Funzione per ottenere il prezzo di listing dell'ultimo NFT di Gen 1
async function getGen1ListingPrice() {
    try {
        const response = await axios.get('https://api.mainnet.tensordev.io/api/v1/mint/active_listings?collId=d48ce4ec-9083-4fc9-84f8-db3f2b53ce92&sortBy=ListingPriceAsc&limit=1&mints=', {
            headers: {
                'accept': 'application/json',
                'x-tensor-api-key': process.env.TENSOR_API_KEY, // Usa la chiave API dai segreti
            },
        });
        const priceInLamport = response.data.mints[0].listing.price; // Prezzo in lamport
        const solPrice = priceInLamport / 1000000000; // Conversione da lamport a sol

        // Aggiungi il 6% di royalties
        const royalties = solPrice * 0.06;
        const priceWithRoyalties = solPrice + royalties;

        return priceWithRoyalties;
    } catch (error) {
        console.error('Errore durante il recupero del prezzo di listing di Gen 1:', error);
        return null;
    }
}

// 🔹 Funzione per ottenere il prezzo di listing dell'ultimo NFT di Gen 2
async function getGen2ListingPrice() {
    try {
        const response = await axios.get('https://api.mainnet.tensordev.io/api/v1/mint/active_listings?collId=f16f63a3-58b6-4a69-ade8-35f6ba817b00&sortBy=ListingPriceAsc&limit=1&mints=', {
            headers: {
                'accept': 'application/json',
                'x-tensor-api-key': process.env.TENSOR_API_KEY, // Usa la chiave API dai segreti
            },
        });
        const priceInLamport = response.data.mints[0].listing.price; // Prezzo in lamport
        const solPrice = priceInLamport / 1000000000; // Conversione da lamport a sol

        // Aggiungi il 6% di royalties
        const royalties = solPrice * 0.06;
        const priceWithRoyalties = solPrice + royalties;

        return priceWithRoyalties;
    } catch (error) {
        console.error('Errore durante il recupero del prezzo di listing di Gen 2:', error);
        return null;
    }
}

// 🔹 Funzione per calcolare la percentuale di sconto
function calculateDiscount(listingPrice, nftValue) {
    if (listingPrice && nftValue) {
        const discount = ((listingPrice - nftValue) / nftValue) * 100;
        return discount.toFixed(2);
    }
    return 'Errore';
}

// 🔹 Funzione per aggiornare il Gist su GitHub
async function updateGist(data) {
    const now = new Date();
    const formattedDate = now.toLocaleString("it-IT", { timeZone: "Europe/Rome" });

    // Ottieni il prezzo di listing con royalties
    const gen1ListingPrice = await getGen1ListingPrice();
    const gen2ListingPrice = await getGen2ListingPrice();

    // Calcola la percentuale di sconto
    const gen1Discount = gen1ListingPrice ? calculateDiscount(gen1ListingPrice, data.nftGen1ValueSol) : 'Errore';
    const gen2Discount = gen2ListingPrice ? calculateDiscount(gen2ListingPrice, data.nftGen2ValueSol) : 'Errore';

    const output = `
🕒 Ultimo aggiornamento: ${formattedDate}

📊 Valori calcolati:
💰 Tesoreria Totale: $${Math.round(data.treasuryValue)}
🔹 Gen 1 Tesoreria (90%): $${Math.round(data.treasuryGen1)}
🔸 Gen 2 Tesoreria (10%): $${Math.round(data.treasuryGen2)}
🔹 Prezzo SOL attuale: $${Math.round(data.solPrice)}

🖼️ Valore reale attuale NFT Gen 1 (Torrino DAO): $${Math.round(data.nftGen1Value)} (${data.nftGen1ValueSol ? data.nftGen1ValueSol.toFixed(2) : 'Errore'} SOL)
🖼️ Valore reale attuale NFT Gen 2 (Solnauta): $${Math.round(data.nftGen2Value)} (${data.nftGen2ValueSol ? data.nftGen2ValueSol.toFixed(2) : 'Errore'} SOL)

📢 Analisi degli sconti sugli NFT:
I prezzi di listing degli NFT sono confrontati con il loro valore reale basato sulla tesoreria.
Se il prezzo di listing è inferiore al valore reale, l'NFT è considerato "in sconto".
Questo può rappresentare un'opportunità di acquisto vantaggiosa rispetto alla valutazione attuale della tesoreria.

🔻 **Prezzi di listing attuali e sconto rispetto al valore reale**:
📉 **Torrino DAO (Gen 1)**: $${Math.round(gen1ListingPrice * data.solPrice)} (${gen1ListingPrice ? gen1ListingPrice.toFixed(2) : 'Errore'} SOL)  
➡️ Differenza rispetto al valore reale: -${gen1Discount}%  

📉 **Solnauta (Gen 2)**: $${Math.round(gen2ListingPrice * data.solPrice)} (${gen2ListingPrice ? gen2ListingPrice.toFixed(2) : 'Errore'} SOL)  
➡️ Differenza rispetto al valore reale: -${gen2Discount}%  

💡 **Nota**: Uno sconto elevato potrebbe indicare un'opportunità di acquisto interessante.
Ma è sempre consigliabile valutare altri fattori di mercato prima di procedere.

🛒 **Acquista ora su Tensor**:
🔗 [Torrino DAO (Gen 1)](https://www.tensor.trade/trade/torrino_dao)  
🔗 [Solnauta (Gen 2)](https://www.tensor.trade/trade/solnauta)
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
        console.log(`✅ Dati salvati in ${FILE_NAME}.`);

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
