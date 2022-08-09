import * as dotenv from "dotenv";
import express, { json } from 'express';
import cors from 'cors';
import Http from 'http';
import Database from './database';
import Finnhub, { StonkCandlesMap } from './finnhub';
import { setTimer } from './util';

dotenv.config();

const timestamps: { [name: string]: number } = {};

const port = process.env.PORT;

const app = express();

app.use(json());
app.use(cors({
	origin: (_origin, callback) => {
		callback(null, true);
	}
}));

const server = Http.createServer(app);

//--------------------------------
// API
//--------------------------------

const allStonks = 'allstonks';
const allStonkCandles = 'allstonkcandles';

app.get('/stonks', async (_request, response) => {
	// get stonk info for all stonks
	const stonkData = await Database.allStonks();

	const portfolio = stonkData.reduce((portfolio, stonk) => {
		portfolio.buyin += stonk.buyin * stonk.menge;
		portfolio.value += stonk.kurs * stonk.menge;
		return portfolio;
	}, { buyin: 0, value: 0, diffEuro: 0, diffPercent: 0 })
	portfolio.diffEuro = portfolio.value - portfolio.buyin;
	portfolio.diffPercent = portfolio.diffEuro / portfolio.buyin * 100;

	const stonks = stonkData.map((stonk) => {
		return {
			symbol: stonk.symbol,
			name: stonk.name,
			count: stonk.menge,
			buyinPrice: stonk.buyin,
			buyinValue: stonk.buyin * stonk.menge,
			currentPrice: stonk.kurs,
			currentValue: stonk.kurs * stonk.menge,
			diffEuro: (stonk.kurs - stonk.buyin) * stonk.menge,
			diffPercent: (stonk.kurs - stonk.buyin) / stonk.buyin * 100,
		}
	});

	response.send({ timestamp: timestamps[allStonks], portfolio, stonks });
});

const validCurrencies = ['EUR', 'USD', 'CAD']

app.post('/stonks', async (request, response) => {
	try {
		if (
			!request.body?.symbol ||
			!request.body?.quantity ||
			!request.body?.price ||
			typeof (request.body?.currency) !== 'string' ||
			!validCurrencies.includes(request.body?.currency?.toUpperCase())
		) {
			response.sendStatus(400);
			return;
		}

		const name = await Finnhub.stonkName(request.body.symbol);

		await Database.insertStonk({
			name: name,
			symbol: request.body.symbol.toUpperCase(),
			buyin: request.body.price,
			menge: request.body.quantity,
			currency: request.body.currency.toUpperCase(),
			kurs: 0
		});

		response.sendStatus(204);
	} catch (error) {
		if (error instanceof Error) {
			console.error(error.message);
		} else {
			console.error(error);
		}
		response.sendStatus(500);
	}
});

app.get('/stonkcandles', async (_request, response) => {
	try {
		const DAY_IN_MS = 86400000;
		const startDate = Date.now() - 91 * DAY_IN_MS;
		const stonks = await Database.allStonks();

		// map StonkCandles[] to { [symbol]: StonkCandles }
		const candles = (await Promise.all(stonks.map(stonk => Finnhub.stonkCandles(stonk.symbol, startDate))))
			.reduce((result: StonkCandlesMap, candles, index) => {
				result[stonks[index].symbol] = candles;
				return result;
			}, {});

		response.send({ timestamp: timestamps[allStonkCandles], candles });
	} catch (error) {
		if (error instanceof Error) {
			console.error(error.message);
		} else {
			console.error(error);
		}
		response.sendStatus(500);
	}
});

server.listen(port);
console.log(`listening on port ${port}`);

//--------------------------------
// Background Polling
//--------------------------------

// Get timestamps from database on start
setImmediate(async () => {
	Object.assign(timestamps, await Database.allTimestamps());
});

// Get current stonk prices and save them in the Database every 5 minutes (300 seconds)
setTimer(async () => {
	try {
		const currencies = await Finnhub.euroRates();
		const stonks = await Database.allStonks();
		const quotes = await Promise.all(stonks.map((stonk) => Finnhub.quote(stonk.symbol)));

		// update timestamp in cache and DB
		timestamps[allStonks] = Date.now();
		await Database.saveTimestamp(allStonks, timestamps[allStonks]);

		quotes.forEach(async (quote, index) => {
			const conversion = currencies[stonks[index].currency] ?? 1;
			await Database.updateStonkPrice(quote.symbol, quote.current / conversion);
		});
	} catch (error) {
		if (error instanceof Error) {
			console.error(`${error.name}: ${error.message}`);
		} else {
			console.error(error);
		}
	}
}, 300_000);
