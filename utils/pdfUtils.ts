import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for pdf.js to load its web worker for processing
// This is required for the library to function correctly in a web environment.
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs`;

/**
 * Converts a PDF file into an array of JPEG image files, one for each page.
 * @param pdfFile The PDF file to convert.
 * @param scale The scale at which to render the PDF pages. Higher scale means better quality and larger file size.
 * @returns A promise that resolves to an array of File objects.
 */
export const convertPdfToImages = async (pdfFile: File, scale: number = 1.5): Promise<File[]> => {
    const images: File[] = [];
    const data = await pdfFile.arrayBuffer();
    
    // Load the PDF document
    const pdf = await pdfjsLib.getDocument(data).promise;
    const numPages = pdf.numPages;

    // Iterate through each page of the PDF
    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        
        // Create a canvas element to render the page
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) {
            throw new Error('Could not get canvas context');
        }

        // FIX: The `page.render` API in `pdf.js` v4+ expects a parameter object with a `canvas` property
        // and returns a promise directly, making the `.promise` accessor obsolete. This change updates
        // the call to match the modern API, resolving the TypeScript error about a missing 'canvas' property.
        await page.render({
            canvasContext: context,
            viewport: viewport,
        });
        
        // Convert the canvas content to a Blob
        const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
        
        // Create a new File object from the Blob
        if (blob) {
            const imageName = `${pdfFile.name.replace(/\.pdf$/i, '')}_page_${i}.jpeg`;
            images.push(new File([blob], imageName, { type: 'image/jpeg' }));
        }
    }

    return images;
};
