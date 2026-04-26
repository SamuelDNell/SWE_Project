const pdfProcessor = require('../utils/pdfProcessor');

describe('PDF Processor Utility', () => {
    describe('cleanText', () => {
        it('should remove isolated page numbers', () => {
            const input = 'This is content\n123\nMore content\n   456   \nEnd';
            const output = pdfProcessor.cleanText(input);
            expect(output).toContain('This is content');
            expect(output).toContain('More content');
            expect(output).toContain('End');
            expect(output).not.toContain('123');
            expect(output).not.toContain('456');
        });

        it('should remove "Page X" patterns', () => {
            const input = 'Header\nPage 1\nContent\nPage 2 of 10\nFooter';
            const output = pdfProcessor.cleanText(input);
            expect(output).toContain('Header');
            expect(output).toContain('Content');
            expect(output).toContain('Footer');
            expect(output).not.toContain('Page 1');
            expect(output).not.toContain('Page 2 of 10');
        });

        it('should normalize whitespace', () => {
            const input = 'Too    much    space\n\n\n\nToo many lines';
            const output = pdfProcessor.cleanText(input);
            expect(output).toBe('Too much space\n\nToo many lines');
        });
    });

    describe('render_page (Geometric Filtering)', () => {
        let mockPageData;

        beforeEach(() => {
            mockPageData = {
                view: [0, 0, 600, 800], // 600x800 page
                getTextContent: jasmine.createSpy('getTextContent').and.returnValue(Promise.resolve({
                    items: [
                        { str: 'Header Text', transform: [0, 0, 0, 0, 50, 750] }, // Y=750 (Top margin)
                        { str: 'Body Text', transform: [0, 0, 0, 0, 50, 400] },   // Y=400 (Middle)
                        { str: 'Page 1', transform: [0, 0, 0, 0, 300, 30] }      // Y=30 (Bottom margin)
                    ]
                }))
            };
        });

        it('should filter out text in the top and bottom 10% margins', async () => {
            // Margin is 10% of 800 = 80. 
            // Valid range is Y between 80 and 720.
            const result = await pdfProcessor.render_page(mockPageData);
            
            expect(result).toContain('Body Text');
            expect(result).not.toContain('Header Text');
            expect(result).not.toContain('Page 1');
        });

        it('should join text items on the same line', async () => {
             mockPageData.getTextContent.and.returnValue(Promise.resolve({
                items: [
                    { str: 'Part 1 ', transform: [0, 0, 0, 0, 50, 400] },
                    { str: 'Part 2', transform: [0, 0, 0, 0, 100, 400] }
                ]
            }));

            const result = await pdfProcessor.render_page(mockPageData);
            expect(result).toBe('Part 1 Part 2');
        });

        it('should add newline for items on different lines', async () => {
             mockPageData.getTextContent.and.returnValue(Promise.resolve({
                items: [
                    { str: 'Line 1', transform: [0, 0, 0, 0, 50, 400] },
                    { str: 'Line 2', transform: [0, 0, 0, 0, 50, 380] }
                ]
            }));

            const result = await pdfProcessor.render_page(mockPageData);
            expect(result).toBe('Line 1\nLine 2');
        });
    });
});
