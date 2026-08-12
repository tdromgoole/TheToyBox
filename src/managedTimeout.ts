export class ManagedTimeout {
	private handle: NodeJS.Timeout | undefined;

	schedule(callback: () => void, delay: number): void {
		this.clear();
		this.handle = setTimeout(() => {
			this.handle = undefined;
			callback();
		}, delay);
	}

	clear(): void {
		if (this.handle) {
			clearTimeout(this.handle);
			this.handle = undefined;
		}
	}

	get pending(): boolean {
		return this.handle !== undefined;
	}
}
