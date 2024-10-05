import fs from "node:fs";
import { readJson, writeJson } from "@x/jsonfile";
import log4js from "npm:log4js";
import path from "node:path";

const logger = log4js.getLogger("foreign-api-cache");

type CachedResponseData<T> = {
    id: string;
    data?: T;
};

type BaseApi<T> = {
    get: (str: string) => Promise<T>;
    list: () => Promise<T[]>;
};

function getDirname(): string {
    const __dirname = import.meta.dirname;
    if (!__dirname) {
        throw new Error("Failed to resolve __dirname");
    }
    return __dirname;
}
export default class ApiWrapper<T> {
    static cacheDir = path.join(getDirname(), "foreign-api-cache");
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
            this.cacheMap = await readJson(this.cacheFile);
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
            this.saveCache()
                .catch(err => logger.error("Failed to save foreign-api-cache!", err));
        } catch (error) {
            console.error(error);
        }
        return data;
    }

    saveCache(): Promise<void> {
        return writeJson(this.cacheFile, this.cacheMap, {
            encoding: "utf8",
            flag: "w",
        });
    }
}
