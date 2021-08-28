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
};

type Replacer = {
    regex: RegExp;
    replace: (match: string) => Promise<Replace>;
};

const replacers: Replacer[] = [
    {
        regex: /\{\{spell:(.+?)\}\}/,
        replace: createSpellTooltip,
    },
    {
        regex: /\{\{section:(.+?)\}\}/,
        replace: createSectionLink,
    },
];

export async function insertSpellTooltips(htmlStr: string) {
    const tooltips: { [key: string]: string | undefined } = {};
    for (const replacer of replacers) {
        const regex = replacer.regex;
        let match = htmlStr.match(regex);

        while (match && match.length > 0) {
            const matchStr = match[1];
            console.log(matchStr);
            const tooltip = await replacer.replace(matchStr);
            // if (tooltip.end) {
            tooltips[tooltip.replace] = tooltip.end;
            // }
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

    let outData = null;
    if (data.name) {
        // console.log(data)
        // out = `<b class="spell">${match}</b>`
        out = `<a href="https://www.aidedd.org/dnd/sorts.php?vo=${data.name.replace(
            " ",
            "-"
        )}" class="spell" data-desc-id="${id + "-desc"}">
        ${match}</a>`;

        outData = {
            replace: out,
            end: `<div id="${id + "-desc"}" class="spell_desc">
            <b class="name">${data.name}</b>
            <span class="spell_meta">Level ${data.level} ${
                data.school.name
            }</span> 
            <span class="cast_time">${data.casting_time}</span>
            <p class="desc">${escapeHtmlArr(data.desc)}</p>
            </div>`,
            id: id,
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
