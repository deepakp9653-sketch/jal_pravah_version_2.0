// Jal Pravah 2.0
const fs = require('fs');
const path = require('path');

// Resolve pdf-parse from the project's node_modules
const pdfParse = require(path.join(__dirname, 'node_modules', 'pdf-parse'));

const pdfPath = path.join(__dirname, 'FloodAffectedAreaAtlas_Digital.pdf');
const dataBuffer = fs.readFileSync(pdfPath);

pdfParse(dataBuffer).then(function(data) {
    console.log('Total pages:', data.numpages);
    console.log('Total text length:', data.text.length);
    
    const text = data.text;
    fs.writeFileSync('C:\\tmp\\pdf_first.txt', text.substring(0, 80000));
    fs.writeFileSync('C:\\tmp\\pdf_mid.txt', text.substring(Math.floor(text.length/2), Math.floor(text.length/2) + 80000));
    fs.writeFileSync('C:\\tmp\\pdf_last.txt', text.substring(text.length - 80000));
    
    console.log('Files written successfully');
}).catch(err => {
    console.error('Error:', err.message);
});
