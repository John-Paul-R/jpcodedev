import dirUtil from "node-dir";

export const getDirReportFiles = async (sourceDirPath: string) => {
    const files = await dirUtil.promiseFiles(sourceDirPath);

    if (!files) {
        console.warn(
            `No files found in pubpath '${sourceDirPath}'. Ensure that the path to the directory is correct and that the directory is not empty.`
        );
        return;
    }

    // const files = objPaths.files;
    return files
        .filter((p) => p.endsWith(".Bench-report.csv"))
        .map((p) =>
            p.substring(
                p.lastIndexOf("/") + 1,
                p.lastIndexOf(".Bench-report.csv")
            )
        );
};
