import MySql from 'mysql';
import { StonkCandles, StonkCandlesMap } from './finnhub';

const connection = MySql.createConnection({
	host: process.env.MARIA_URL,
	user: process.env.MARIA_USER,
	password: process.env.MARIA_PASSWORD,
	database: 'wsbstonks',
});

connection.connect();

export interface Timestamps {
	/** unix timestamp in ms */
	[name: string]: number
}

export type Stonk = {
	name: string,
	symbol: string,
	buyin: number,
	menge: number,
	kurs: number,
	currency: string,
};

// TODO write insert function for Stonk Candles

export default class Database {
	//--------------------------------
	// Timestamps
	//--------------------------------

	static async allTimestamps(): Promise<Timestamps> {
		return new Promise((resolve, reject) => {
			connection.query(
				`SELECT * FROM timestamps`,
				(error, data) => {
					if (error) reject(error)
					const timestamps: Timestamps = {};
					data.forEach((timestamp: { name: string, timestamp: number }) => {
						timestamps[timestamp.name] = timestamp.timestamp * 1000;
					});
				}
			);
		});
	}

	/** @param timestamp unix timestamp in ms */
	static async saveTimestamp(name: string, timestamp: number): Promise<void> {
		timestamp /= 1000;
		return new Promise((resolve, reject) => {
			connection.query(
				`INSERT INTO timestamps (name, timestamp) VALUES ("${name}", ${timestamp})
				ON DUPLICATE KEY UPDATE timestamp = ${timestamp}`,
				(error) => error ? reject(error) : resolve()
			)
		});
	}

	//--------------------------------
	// Stonks
	//--------------------------------

	/**
	 * Gets all stonks from the database
	 * @returns `null` on failure
	 */
	static async allStonks(): Promise<Stonk[]> {
		return new Promise((resolve, reject) => {
			connection.query(
				`SELECT * FROM aktuelleStonks`,
				(error, data) => error ? reject(error) : resolve(data)
			);
		});
	}

	/**
	 * Adds a new stonk to the database
	 * @throws {MysqlError}
	 */
	static async insertStonk(
		{ name, symbol, buyin, menge, kurs, currency }: Stonk
	): Promise<void> {
		return new Promise((resolve, reject) => {
			connection.query(
				`INSERT INTO aktuelleStonks (name, symbol, buyin, menge, kurs, currency)
				VALUES ("${name}", "${symbol}", "${buyin}", "${menge}", "${kurs}", "${currency}")`,
				(error) => error ? reject(error) : resolve()
			);
		});
	}

	static async updateStonkPrice(symbol: string, price: number): Promise<void> {
		return new Promise((resolve, reject) => {
			connection.query(
				`UPDATE aktuelleStonks SET kurs = "${price}" WHERE symbol LIKE "${symbol}"`,
				(error) => error ? reject(error) : resolve()
			);
		});
	}

	/**
	 * Delete all entries from the database with the given symbol
	 * @returns `false` on failure
	 */
	static async deleteStonk(symbol: string): Promise<void> {
		return new Promise((resolve, reject) => {
			connection.query(
				`DELETE FROM aktuelleStonks WHERE symbol LIKE "${symbol}"`,
				(error) => error ? reject(error) : resolve()
			);
		});
	}

	//--------------------------------
	// Stonks Candles
	//--------------------------------

	// TODO: take start and end time as parameters
	static async allStonkCandles(): Promise<StonkCandlesMap> {
		interface Candle {
			symbol: string,
			/** unix timestamp in s */
			timestamp: number,
			open: number,
			close: number,
			high: number,
			low: number,
		};

		return new Promise((resolve, reject) => {
			connection.query(
				`SELECT * FROM stonkCandleData
				ORDER BY symbol, timestamp ASC`,
				(error, data: Candle[]) => {
					if (error) reject(error)
					const grouped = data.group(item => item.symbol);
					const result = {} as StonkCandlesMap;
					Object.keys(grouped).forEach((symbol) => {
						const candles: StonkCandles = { closes: [], highs: [], lows: [], opens: [], times: [] };

						grouped[symbol].forEach((candle) => {
							candles.closes.push(candle.close);
							candles.highs.push(candle.high);
							candles.lows.push(candle.low);
							candles.opens.push(candle.open);
							candles.times.push(candle.timestamp * 1000);
						});

						result[symbol] = candles;
					});

					resolve(result)
				}
			);
		});
	}
}
