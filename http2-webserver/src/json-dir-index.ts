export const getDirReportFiles = async (sourceDirPath: string) => {
    const files = await Array.fromAsync(Deno.readDir(sourceDirPath));

    if (!files) {
        console.warn(
            `No files found in pubpath '${sourceDirPath}'. Ensure that the path to the directory is correct and that the directory is not empty.`,
        );
        return;
    }

    // const files = objPaths.files;
    return files
        .filter((dirEnt) => dirEnt.name.endsWith(".Bench-report.csv"))
        .map((dirEnt) =>
            dirEnt.name.substring(
                dirEnt.name.lastIndexOf("/") + 1,
                dirEnt.name.lastIndexOf(".Bench-report.csv"),
            )
        );
};
