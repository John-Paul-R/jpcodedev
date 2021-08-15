
const fs = require('fs');
const path = require('path');

class ApiWrapper {

    static cacheDir = path.join(__dirname, 'foreign-api-cache');
    /**
     * 
     * @param {*} getter
     * @param {function} getter.get 
     * @param {string} apiName 
     */
    constructor(getter, apiName) {
        this.getter = getter;
        this.cacheFile = path.join(ApiWrapper.cacheDir, `${apiName}.json`);
        try {
            fs.mkdirSync(ApiWrapper.cacheDir);
        } catch (error) {
            console.warn(error);
        }
        this.cacheMap = {};
    }

    async loadCache() {
        try {
            this.cacheMap = JSON.parse(fs.readFileSync(this.cacheFile));
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * 
     * @param {string} queryStr 
     * @returns {object}
     */
    async get(queryStr) {
        queryStr = queryStr.toLowerCase();
        return this.cacheMap[queryStr]?.data ?? await this._get(queryStr);
    }

    /**
     * Get & cache data form foreign repo.
     * 
     * DO NOT CALL THIS METHOD. Use `get` instead.
     * Will automatically be called when needed.
     * 
     * @param {string} queryStr 
     * @returns {object}
     */
    async _get(queryStr) {
        let data = null;
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
        fs.writeFileSync(this.cacheFile, JSON.stringify(this.cacheMap), 'utf8', 'w');
    }

}

module.exports.ApiWrapper = ApiWrapper;