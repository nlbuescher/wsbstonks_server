declare global {
	interface Number {
		round(places?: number): number
	}

	interface Array<T> {
		group(selector: (item: T, index: number) => string): { [key: string]: T[] }
	}
}

Number.prototype.round = function (places = 0): number {
	const factor = 10 ** places;
	return Math.round(this as number * factor) / factor;
}


Array.prototype.group = function <T>(
	keySelector: (item: T, index: number) => string
): { [key: string]: T[] } {
	const destination = {} as { [key: string]: T[] };
	this.forEach((item, index) => {
		const key = keySelector(item, index);
		if (!destination[key]) destination[key] = [];
		destination[key].push(item)
	});
	return destination;
}


export function setTimer(
	callback: (...args: unknown[]) => void,
	delay?: number,
	...args: unknown[]
): void {
	callback(args);
	setInterval(callback, delay, args);
}
