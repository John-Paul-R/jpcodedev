import showdown from 'showdown';
import showdownHighlight from 'showdown-highlight';
import Path from "node:path";

type ShowdownContext = {
    imagePath?: string;
}

class MdToHtmlConverter {
    private converter: showdown.Converter;
    private context: ShowdownContext;

    constructor(options: showdown.ConverterOptions = {}) {
        // default context
        this.context = { imagePath: '/' };
        
        this.converter = new showdown.Converter({
            tables: true,
            strikethrough: true,
            disableForced4SpacesIndentedSublists: true,
            ...options,
            extensions: [
                this.createWikiImageConverter(),
                showdownHighlight({
                    pre: true,
                }),
                ...(options.extensions || [])
            ]
        });
    }

    private createWikiImageConverter() {
        return [{
            type: 'lang',
            regex: /!\[\[(.*?\.(?:png|jpg|jpeg|gif|svg|webp))\]\]/g,
            replace: (match: unknown, filename: string) => {
                const imagePath = this.context.imagePath || '/';
                const imageUrl = `https://${Path.join('static.jpcode.dev', imagePath, filename)}`;
                return `![${filename}](${encodeURI(imageUrl)})`;
            }
        }];
    }

    // Method to update context
    setContext(newContext: Partial<ShowdownContext>) {
        this.context = {
            ...this.context,
            ...newContext
        };
    }

    // Wrapper for makeHtml that optionally accepts context
    makeHtml(markdown: string, context?: Partial<ShowdownContext>): string {
        if (context) {
            // Temporarily set context for this conversion
            const oldContext = { ...this.context };
            this.setContext(context);
            const result = this.converter.makeHtml(markdown);
            this.context = oldContext;
            return result;
        }
        
        return this.converter.makeHtml(markdown);
    }

    // Expose other converter methods as needed
    getConverter(): showdown.Converter {
        return this.converter;
    }
}

export { MdToHtmlConverter, type ShowdownContext };