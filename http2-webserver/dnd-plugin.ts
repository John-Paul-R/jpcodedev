/* eslint-disable indent */
import { spellInfo, Spells as spells } from "dnd-api";
import ApiWrapper from "./foreign-api-cache";

const spellsWrapper = new ApiWrapper(spells, "dnd-api-spells");

function replaceRange(
    s: string,
    start: number,
    end: number,
    substitute: string
) {
    return s.substring(0, start) + substitute + s.substring(end);
}

type Replace = {
    replace: string;
    end?: string;
    id: string;
    rawData?: {};
};

type Replacer = {
    regex: RegExp;
    replace: (match: string) => Promise<Replace>;
    outVarName: string;
};

const replacers: Replacer[] = [
    {
        regex: /\{\{spell:(.+?)\}\}/,
        replace: createSpellTooltip,
        outVarName: "spell_desc_data",
    },
    {
        regex: /\{\{section:(.+?)\}\}/,
        replace: createSectionLink,
        outVarName: "section_links",
    },
];

/**
 * @param htmlStr Page html in string form.
 */
export async function insertSpellTooltips(htmlStr: string) {
    const tooltips: { [key: string]: string | undefined } = {};
    for (const replacer of replacers) {
        const rawData: { [key: string]: {} } = {};
        const regex = replacer.regex;
        let match = htmlStr.match(regex);

        while (match && match.length > 0) {
            const matchStr = match[1];
            console.log(matchStr);
            const tooltip = await replacer.replace(matchStr);
            if (tooltip.end) {
                tooltips[tooltip.id] = tooltip.end;
            }
            rawData[tooltip.id] = tooltip.rawData ?? {};
            if (match.index) {
                htmlStr = replaceRange(
                    htmlStr,
                    match.index,
                    match.index + match[0].length,
                    tooltip.replace
                );
            }

            match = htmlStr.match(regex);
        }

        htmlStr +=
            Object.keys(rawData).length > 0
                ? `<script>var ${replacer.outVarName} = ${JSON.stringify(
                      rawData
                  )}</script>`
                : "";
    }

    for (const elem of Object.values(tooltips)) {
        htmlStr += elem;
    }

    htmlStr += `<script src="https://static.jpcode.dev/js/dnd-tooltips.js"></script>`;

    return htmlStr;
}

/**
 *
 * @param {String} match
 */
async function createSpellTooltip(match: string) {
    let out = match;
    const id = match.toLowerCase().trim();
    const data = (await spellsWrapper.get(match)) as spellInfo;
    console.log(data.name);
    let outData = null;
    if (data.name) {
        // console.log(data)
        // out = `<b class="spell">${match}</b>`
        const descId = id; // + "-desc";

        out = `<a href="https://www.aidedd.org/dnd/sorts.php?vo=${data.name.replace(
            " ",
            "-"
        )}" class="spell" data-desc-id="${descId}">
        ${match}</a>`;
        const rawData = {
            name: data.name,
            level: data.level,
            school: data.school.name,
            casting_time: data.casting_time,
            desc: data.desc,
        };
        outData = {
            replace: out,
            id: id,
            rawData,
        };
    } else {
        outData = {
            replace: match,
            end: `<div class="spell_desc">${match}</div>`,
            id: id,
        };
    }

    return outData;
    // <span class="level">${data.level}</span>
    // <span class="school">${data.school.name}</span>
}

async function createSectionLink(sectionId: string) {
    const formatted = sectionId.toLowerCase().trim();
    return {
        id: formatted,
        replace: `<a href="#${formatted.replace(" ", "")}">${sectionId}</a>`,
    };
}

function escapeHtmlArr(unsafe: string[]) {
    let out = "";
    for (const str of unsafe) {
        out += `<p>${escapeHtml(str)}</p>`;
    }
    return out;
}
function escapeHtml(htmlStr: string) {
    return (htmlStr ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
exports.insertSpellTooltips = insertSpellTooltips;
