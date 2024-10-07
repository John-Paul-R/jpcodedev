/* eslint-disable indent */
import ApiWrapper from "./foreign-api-cache.ts";

const BASE_URL = "https://www.dnd5eapi.co";

type APIReference = {
    index?: string;
    level?: number;
    name: string;
    url?: string;
};

type AreaOfEffect = {
    size?: number;
    type?: "sphere" | "cone" | "cylinder" | "line" | "cube";
};

type SpellResponse = {
    index?: string;
    level: number;
    name: string;
    url?: string;
    desc?: string[];
    higher_level?: string[];
    range?: string;
    components?: Array<"V" | "S" | "M">;
    material?: string;
    area_of_effect?: AreaOfEffect;
    ritual?: boolean;
    duration?: string;
    concentration?: boolean;
    casting_time?: string;
    attack_type?: string;
    damage?: unknown; // The structure of 'damage' is not specified in the provided description
    school: APIReference;
    classes?: APIReference[];
    subclasses?: APIReference[];
};
export function getSpell(spellName: string): Promise<SpellResponse> {
    return fetch(BASE_URL + "/api/spells/" + spellName)
        .then((response) => response.json());
}
export function getAllSpells(): Promise<SpellResponse[]> {
    return fetch(BASE_URL + "/api/spells")
        .then((response) => response.json());
}

const spellsWrapper = new ApiWrapper({
    get: getSpell,
    list: getAllSpells,
}, "dnd-api-spells");

function replaceRange(
    s: string,
    start: number,
    end: number,
    substitute: string,
) {
    return s.substring(0, start) + substitute + s.substring(end);
}

type ReplaceInstruction = {
    replacement: string;
    end?: string;
    id: string;
    rawData?: unknown;
};

type Replacer = {
    regex: RegExp;
    replace: (match: string) => Promise<ReplaceInstruction>;
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
export async function insertSpellTooltips(htmlStr: string): Promise<string> {
    const tooltips: { [key: string]: string | undefined } = {};
    for (const replacer of replacers) {
        const rawData: { [key: string]: unknown } = {};
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
                    tooltip.replacement,
                );
            }

            match = htmlStr.match(regex);
        }

        htmlStr += Object.keys(rawData).length > 0
            ? `<script>var ${replacer.outVarName} = ${
                JSON.stringify(
                    rawData,
                )
            }</script>`
            : "";
    }

    for (const elem of Object.values(tooltips)) {
        htmlStr += elem;
    }

    htmlStr +=
        `<script src="https://static.jpcode.dev/js/dnd-tooltips.js"></script>`;

    return htmlStr;
}

/**
 * @param {String} match
 */
async function createSpellTooltip(match: string): Promise<ReplaceInstruction> {
    const id = match.toLowerCase().trim();

    try {
        const data = await spellsWrapper.get(match);
        console.log(data?.name);
        if (data === null) {
            throw new Error(`Failed to resolve spell '${id}'`);
        }
        const descId = id; // + "-desc";
        const nameAsVo = data.name.replace(" ", "-");
        return {
            replacement:
                `<a href="https://www.aidedd.org/dnd/sorts.php?vo=${nameAsVo}" class="spell" data-desc-id="${descId}">${match}</a>`,
            id: id,
            rawData: {
                name: data.name,
                level: data.level,
                school: data.school.name,
                casting_time: data.casting_time,
                desc: data.desc,
            },
        };
    } catch {
        return {
            replacement: match,
            end: `<div class="spell_desc">${match}</div>`,
            id: id,
        };
    }

    // <span class="level">${data.level}</span>
    // <span class="school">${data.school.name}</span>
}

function createSectionLink(sectionId: string): Promise<ReplaceInstruction> {
    const formatted = sectionId.toLowerCase().trim();
    return Promise.resolve({
        id: formatted,
        replacement: `<a href="#${
            formatted.replace(" ", "")
        }">${sectionId}</a>`,
    });
}

// deno-lint-ignore no-unused-vars
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
