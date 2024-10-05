import fs from "node:fs";

export function runWith(
    fileDescriptor: number,
    func: (fileDescriptor: number) => void
) {
    try {
        func(fileDescriptor);
    } catch (e) {
        console.error(e);
    } finally {
        fs.close(fileDescriptor);
    }
}

export function trimTrailingSlash(pathStr: string) {
    let out: string;
    if (pathStr.endsWith("/")) out = pathStr.substr(0, pathStr.length - 1);
    else out = pathStr;
    return out;
}
