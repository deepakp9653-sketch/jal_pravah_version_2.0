// Jal Pravah 2.0
import fs from 'fs';
import PDFParser from 'pdf2json';

const pdfParser = new PDFParser(null, 1);

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    const rawText = pdfParser.getRawTextContent();
    console.log("Extraction complete, text length:", rawText.length);
    fs.writeFileSync('C:/tmp/pdf_full_text.txt', rawText);
    fs.writeFileSync('C:/tmp/pdf_first.txt', rawText.substring(0, 80000));
    fs.writeFileSync('C:/tmp/pdf_mid.txt', rawText.substring(Math.floor(rawText.length/2), Math.floor(rawText.length/2) + 80000));
    fs.writeFileSync('C:/tmp/pdf_last.txt', rawText.substring(Math.max(0, rawText.length - 80000)));
    console.log("Saved to /tmp/pdf_full_text.txt");
});

console.log("Loading PDF...");
pdfParser.loadPDF("./FloodAffectedAreaAtlas_Digital.pdf");
