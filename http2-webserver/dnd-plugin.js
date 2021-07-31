const spells = require("dnd-api").Spells;

// const response = await spells.get("Cat");

function replaceRange(s, start, end, substitute) {
    return s.substring(0, start) + substitute + s.substring(end);
}

/**
 * 
 * @param {String} htmlStr 
 */
async function insertSpellTooltips(htmlStr) {
    const regex = /\{\{spell\:(.+?)\}\}/;
    let match = htmlStr.match(regex);
    const tooltips = {};
    while (match && match.length > 0) {
        let matchStr = match[1];
        console.log(matchStr);
        let tooltip = await createSpellTooltip(matchStr);
        tooltips[tooltip.replace] = tooltip.end;
        console.log(tooltip)
        htmlStr = replaceRange(htmlStr, match.index, match.index+match[0].length, tooltip.replace);
        
        match = htmlStr.match(regex);
        // console.log(tooltips);
    }
    for (const elem of Object.values(tooltips)) {
        htmlStr += elem;
    }
    htmlStr += `<script src="https://static.jpcode.dev/js/dnd-tooltips.js"></script>`

    return htmlStr;
}

/**
 * 
 * @param {String} match 
 */
async function createSpellTooltip(match) {
    let out = match;
    let id = match.toLowerCase().trim();
    let data = await spells.get(match);
    // console.log(data)
    // out = `<b class="spell">${match}</b>`
    out = `<a href="https://www.aidedd.org/dnd/sorts.php?vo=${data.name.replace(' ','-')}" class="spell" data-desc-id="${id+"-desc"}">
    ${match}</a>`;
    
    return {
        replace: out,
        end: `<div id="${id+"-desc"}" class="spell_desc">
        <b class="name">${data.name}</b>
        <span class="spell_meta">Level ${data.level} ${data.school.name}</span> 
        <span class="cast_time">${data.casting_time}</span>
        <p class="desc">${escapeHtmlArr(data.desc)}</p>
        </div>`, 
        id: id,
    };
    // <span class="level">${data.level}</span>
    // <span class="school">${data.school.name}</span>
        
}

//TODO make the tooltip go towards the center of the screen
/**
 * 
 * @param {Array<String>} unsafe 
 * @returns 
 */
function escapeHtmlArr(unsafe) {
    let out = ""
    for (const str of unsafe) {
        out += `<p>${escapeHtml(str)}</p>`;
    }
    return out;
         
}
function escapeHtml(htmlStr) {
    return htmlStr
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
exports.insertSpellTooltips = insertSpellTooltips;