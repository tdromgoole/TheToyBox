/**
 * pdfAssembler.ts
 *
 * Shared PDF-1.4 binary assembler. Accepts per-page content streams and a
 * font resource list, and returns a ready-to-save Buffer.
 *
 * Used by both the code printer (printer.ts) and the markdown PDF renderer
 * (markdownToPdf.ts).
 */

const PDF_W = 595; // A4 width  (pts)
const PDF_H = 842; // A4 height (pts)

export interface PdfFontEntry {
	/** Resource name used inside content streams, e.g. "F1" */
	name: string;
	/** PDF BaseFont name, e.g. "Courier-Bold" */
	base: string;
}

/**
 * Assemble a complete PDF-1.4 binary from per-page content streams.
 *
 * Object layout:
 *   1 = Catalog
 *   2 = Pages
 *   3 … 3+(fonts.length-1) = Font objects
 *   3+fonts.length + 2*i   = Page(i)
 *   3+fonts.length + 2*i+1 = ContentStream(i)
 */
export function assemblePdf(
	pageContents: string[],
	title: string,
	fonts: PdfFontEntry[],
): Buffer {
	const n = pageContents.length;
	const fontBase = 3; // first font object number
	const pageBase = fontBase + fonts.length; // first page object number
	const totalObjs = pageBase + n * 2; // xref /Size (includes free obj 0)

	const pageObjNum = (i: number) => pageBase + i * 2;
	const streamObjNum = (i: number) => pageBase + i * 2 + 1;

	const chunks: Buffer[] = [];
	const offsets = new Array<number>(totalObjs).fill(0);

	const fileHeader = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1");
	chunks.push(fileHeader);
	let offset = fileHeader.length;

	function pushObj(num: number, buf: Buffer): void {
		offsets[num] = offset;
		chunks.push(buf);
		offset += buf.length;
	}
	function simpleObj(num: number, dict: string): Buffer {
		return Buffer.from(`${num} 0 obj\n${dict}\nendobj\n`, "ascii");
	}
	function streamObjBuf(num: number, streamBuf: Buffer): Buffer {
		return Buffer.concat([
			Buffer.from(
				`${num} 0 obj\n<< /Length ${streamBuf.length} >>\nstream\n`,
				"ascii",
			),
			streamBuf,
			Buffer.from("\nendstream\nendobj\n", "ascii"),
		]);
	}

	// 1: Catalog
	pushObj(1, simpleObj(1, `<< /Type /Catalog /Pages 2 0 R >>`));

	// 2: Pages
	const kids = Array.from(
		{ length: n },
		(_, i) => `${pageObjNum(i)} 0 R`,
	).join(" ");
	pushObj(2, simpleObj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`));

	// Font objects
	fonts.forEach((f, fi) => {
		pushObj(
			fontBase + fi,
			simpleObj(
				fontBase + fi,
				`<< /Type /Font /Subtype /Type1 /BaseFont /${f.base} /Encoding /WinAnsiEncoding >>`,
			),
		);
	});

	// Build the font resource dictionary string for page objects
	const fontRes = fonts
		.map((f, fi) => `/${f.name} ${fontBase + fi} 0 R`)
		.join(" ");

	// Page / content-stream pairs
	for (let i = 0; i < n; i++) {
		const pn = pageObjNum(i);
		const sn = streamObjNum(i);
		pushObj(
			pn,
			simpleObj(
				pn,
				`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_W} ${PDF_H}] ` +
					`/Contents ${sn} 0 R ` +
					`/Resources << /Font << ${fontRes} >> >> >>`,
			),
		);
		pushObj(sn, streamObjBuf(sn, Buffer.from(pageContents[i], "latin1")));
	}

	// Cross-reference table
	const xrefOffset = offset;
	const xrefLines: string[] = [
		`xref\n0 ${totalObjs}\n`,
		"0000000000 65535 f \n",
	];
	for (let i = 1; i < totalObjs; i++) {
		xrefLines.push(String(offsets[i]).padStart(10, "0") + " 00000 n \n");
	}
	chunks.push(Buffer.from(xrefLines.join(""), "ascii"));

	// Trailer
	const safeTitle = title
		.replace(/\\/g, "\\\\")
		.replace(/\(/g, "\\(")
		.replace(/\)/g, "\\)")
		.replace(/[^\x20-\x7E]/g, "?");
	chunks.push(
		Buffer.from(
			`trailer\n<< /Size ${totalObjs} /Root 1 0 R /Info << /Title (${safeTitle}) >> >>\n` +
				`startxref\n${xrefOffset}\n%%EOF\n`,
			"ascii",
		),
	);

	return Buffer.concat(chunks);
}

/** Standard 4-font Courier family used by the code printer. */
export const CODE_PDF_FONTS: PdfFontEntry[] = [
	{ name: "F1", base: "Courier" },
	{ name: "F2", base: "Courier-Bold" },
	{ name: "F3", base: "Courier-Oblique" },
	{ name: "F4", base: "Courier-BoldOblique" },
];
