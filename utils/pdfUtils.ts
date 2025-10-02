import * as pdfjsLib from 'pdfjs-dist';
// FIX: The 'RenderParameters' type is not exported from the main 'pdfjs-dist' module.
// It has been removed from the import, and the type cast for the render call below is updated.
import type { PageViewport } from 'pdfjs-dist';

// Set worker source for pdf.js to load its web worker for processing
// This is required for the library to function correctly in a web environment.
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs`;

/**
 * Converts a PDF file into an array of JPEG image files, one for each page.
 * Renders pages at a higher resolution (approximating 150 DPI) to improve OCR accuracy.
 * @param pdfFile The PDF file to convert.
 * @param onProgress An optional callback to report conversion progress.
 * @returns A promise that resolves to an array of File objects.
 */
export const convertPdfToImages = async (
    pdfFile: File,
    onProgress?: (progress: { currentPage: number; totalPages: number }) => void
): Promise<File[]> => {
    const images: File[] = [];
    const data = await pdfFile.arrayBuffer();
    
    // Define a fixed scale to approximate 150 DPI for better OCR quality.
    // The default PDF viewer resolution is 72 DPI, so 150/72 ≈ 2.08. We use 2.0 for simplicity.
    const scale = 2.0;
    
    // Load the PDF document
    const pdf = await pdfjsLib.getDocument(data).promise;
    const numPages = pdf.numPages;

    // Iterate through each page of the PDF
    for (let i = 1; i <= numPages; i++) {
        // Report progress
        if (onProgress) {
            onProgress({ currentPage: i, totalPages: numPages });
        }

        const page = await pdf.getPage(i);
        const viewport: PageViewport = page.getViewport({ scale });
        
        // Create a canvas element to render the page
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) {
            throw new Error('Could not get canvas context');
        }

        // The `page.render` method returns a `RenderTask` object. We must `await` its `promise` property
        // to ensure rendering is complete. The type definitions for this version of pdf.js also
        // require the 'canvas' property to be passed in the parameters.
        // FIX: Since `RenderParameters` is not exported, we cast to `any` to allow compilation
        // while preserving the parameters passed to the render function.
        await page.render({
            canvas: canvas,
            canvasContext: context,
            viewport: viewport,
        } as any).promise;
        
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
