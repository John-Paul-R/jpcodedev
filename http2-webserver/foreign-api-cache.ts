import fs from "fs";
import path from "path";

type CachedResponseData<T> = {
    id: string;
    data?: T;
};

type BaseApi<T> = {
    get: (str: string) => Promise<T>;
    list: () => Promise<T[]>;
};

export default class ApiWrapper<T> {
    static cacheDir = path.join(__dirname, "foreign-api-cache");
    getter: BaseApi<T>;
    cacheFile: string;
    cacheMap: { [key: string]: CachedResponseData<T> };
    constructor(getter: BaseApi<T>, apiName: string) {
        this.getter = getter;
        this.cacheFile = path.join(ApiWrapper.cacheDir, `${apiName}.json`);
        try {
            fs.mkdirSync(ApiWrapper.cacheDir, { recursive: true });
        } catch (error) {
            console.warn(error);
        }
        this.cacheMap = {};
    }

    async loadCache() {
        try {
            this.cacheMap = JSON.parse(
                fs.readFileSync(this.cacheFile).toString()
            );
        } catch (error) {
            console.error(error);
        }
    }

    async get(queryStr: string): Promise<T | null> {
        queryStr = queryStr.toLowerCase();
        return this.cacheMap[queryStr]?.data ?? (await this._get(queryStr));
    }

    /**
     * Get & cache data form foreign repo.
     *
     * DO NOT CALL THIS METHOD. Use `get` instead.
     * Will automatically be called when needed.
     *
     * @param {string} queryStr
     * @returns {ResponseData}
     */
    async _get(queryStr: string): Promise<T | null> {
        let data: T | null = null;
        try {
            data = await this.getter.get(queryStr);
            this.cacheMap[queryStr] = {
                id: queryStr,
                data: data,
            };
            this.saveCache();
        } catch (error) {
            console.error(error);
        }
        return data;
    }

    async saveCache() {
        fs.writeFileSync(this.cacheFile, JSON.stringify(this.cacheMap), {
            encoding: "utf8",
            flag: "w",
        });
    }
}
