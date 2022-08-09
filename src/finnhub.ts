import { IncomingMessage } from 'http';
import Https from 'https';

const apiKey = process.env.FINNHUB_KEY;
const sandboxKey = process.env.FINNHUB_SANDBOX_KEY;

/**
 * @throws {Error | string}
 */
async function request(options: Https.RequestOptions): Promise<string> {
	return new Promise((resolve, reject) => {
		const request = Https.request(
			{ ...options, method: 'get' },
			(response: IncomingMessage) => {
				let data = '';

				response.on('data', chunk => { data += chunk; });

				response.on('end', () => {
					if (
						response?.statusCode &&
						response.statusCode >= 200 &&
						response.statusCode < 400
					) {
						resolve(data)
					} else {
						reject(data)
					}
				});
			}
		);

		request.on('error', error => reject(error));

		request.end();
	});
}

export type Currencies = {
	[name: string]: number | undefined,
}

export type Quote = {
	symbol: string,
	current: number,
	high: number,
	low: number,
	open: number,
	previousClose: number,
};

export type StonkCandles = {
	closes: number[],
	highs: number[],
	lows: number[],
	opens: number[],
	/** unix timestamps in ms */
	times: number[],
}

export type StonkCandlesMap = {
	[symbol: string]: StonkCandles,
}

export type Metrics = {
	yearLow: number,
	yearHigh: number,
	peRatio: number,
}

export default class Finnhub {
	/**
	 * Gets the quote for the stonk with the given symbol
	 * @throws {Error | string}
	 */
	static async quote(symbol: string): Promise<Quote> {
		// needs sandbox key to get quotes for ETFs. returns 403 otherwise
		const quote = JSON.parse(
			await request({
				hostname: 'finnhub.io',
				path: `/api/v1/quote?symbol=${symbol}&token=${sandboxKey}`,
			})
		);

		if (
			!quote?.c ||
			!quote?.h ||
			!quote?.l ||
			!quote?.o ||
			!quote?.pc
		) {
			throw Error(`could not get quote for '${symbol}'`);
		}

		return {
			symbol: symbol,
			current: quote.c,
			high: quote.h,
			low: quote.l,
			open: quote.o,
			previousClose: quote.pc,
		};
	}

	/**
	 * Gets the candles for the stonk matching the given symbol
	 * @param start unix timestamp for the lower bound
	 * @param end unix timestamp for the upper bound
	 * @throws {Error | string}
	 */
	static async stonkCandles(
		symbol: string,
		start: number,
		end: number = Date.now(),
	): Promise<StonkCandles> {
		const candles = JSON.parse(
			await request({
				hostname: 'finnhub.io',
				path: `/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${start}&to=${end}&token=${sandboxKey}`,
			})
		);

		if (
			!candles?.c ||
			!candles?.h ||
			!candles?.l ||
			!candles?.o ||
			!candles?.t
		) throw Error(`could not get candles for '${symbol}'`);

		return { closes: candles.c, highs: candles.h, lows: candles.l, opens: candles.o, times: candles.t };
	}

	/**
	 * Gets the company name of the stonk with the given symbol
	 * @throws {Error | string}
	 */
	static async stonkName(symbol: string): Promise<string> {
		// needs normal api key to get company profile 2. returns garbage data otherwise
		let profile = JSON.parse(
			await request({
				hostname: 'finnhub.io',
				path: `/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`,
			})
		);

		if (profile?.name) return profile.name;

		// get name of ETF since company name was not found

		// needs normal api key to get etf profile data. returns garbage data otherwise
		profile = JSON.parse(
			await request({
				hostname: 'finnhub.io',
				path: `/api/v1/etf/profile?symbol=${symbol}&token=${apiKey}`,
			})
		);

		if (!profile?.profile?.name) throw Error(`could not get stonk name for '${symbol}'`);

		return profile.profile.name
	}

	/**
	 * Gets the 52-week low, 52-week high, and P:E ratio metrics for the stonk matching the given symbol
	 * @throws {Error | string}
	 */
	static async metrics(symbol: string): Promise<Metrics> {
		const financials = JSON.parse(
			await request({
				hostname: 'finnhub.io',
				path: `/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`
			})
		);

		if (
			!financials?.metric?.['52WeekLow'] ||
			!financials?.metric?.['52WeekHigh'] ||
			!financials?.metric?.peExclExtraTTM
		) throw Error(`could not get metrics for '${symbol}'`);

		return {
			yearLow: financials.metric['52WeekLow'],
			yearHigh: financials.metric['52WeekHigh'],
			peRatio: financials.metric.peExclExtraTTM,
		}
	}

	/**
	 * Gets a url for the company's logo. Doesn't work for ETFs
	 * @returns `null` if no logo url is found
	 * @throws {Error | string}
	 */
	static async logoUrl(symbol: string): Promise<string | null> {
		const profile = JSON.parse(
			await request({
				hostname: 'finnhub.io',
				path: `/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`,
			})
		);

		return profile?.logo ?? null;
	}

	/**
	 * @throws {Error | string}
	 */
	static async euroRates(): Promise<Currencies> {
		const rates = JSON.parse(
			await request({
				hostname: 'finnhub.io',
				path: `/api/v1/forex/rates?base=EUR&token=${sandboxKey}`,
			})
		);

		if (!rates?.quote) throw Error('could not get euro currency conversions');

		return { ...rates.quote };
	}
}
