import fetch from 'node-fetch';
import fs from "fs";
import https from 'https';
import readline from "readline";

const thumbSize = 480;
const headers = {
    "headers": fs.readFileSync("headers.json", "utf-8"),
    "body": null,
    "method": "GET",
};

function go(thread_id, cursor) {
    let curse = "/";
    if (cursor) curse = "/?cursor=" + cursor;
    fetch("https://i.instagram.com/api/v1/direct_v2/threads/" + thread_id + curse, headers)
        .then(r => r.json()).then(function (j) {
        let latest = 9007199254740991, latest_id;
        for (let t = 0; t < j['thread'].items.length; t++) {
            let it = j['thread'].items[t];

            let body = "", images, url, dest;
            switch (it['item_type']) {
                case 'text':
                    body = it["text"];
                    break;
                case 'action_log':
                    let act = it['action_log']['description'];
                    //console.log(it['hide_in_thread']);
                    //throw new Error(JSON.stringify(it, null, 2));
                    if (act === "Liked a message") body = '<svg xmlns="https://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-heart-fill" viewBox="0 0 16 16">\n' +
                        '  <path fill-rule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/>\n' +
                        '</svg>';
                    break;
                case 'felix_share':
                case 'clip':
                case 'story_share':
                case 'media':
                case 'media_share': // it.media_share.video_versions
                    let least = 100000, itsType = it[it['item_type']];
                    if (itsType.hasOwnProperty('media')) // story_share
                        itsType = itsType['media'];
                    if (itsType.hasOwnProperty('image_versions2'))
                        images = itsType;
                    else if (itsType.hasOwnProperty('carousel_media'))
                        images = itsType['carousel_media'][0];
                    else if (itsType.hasOwnProperty('clip')) // clip
                        images = itsType['clip']['clip'];
                    else if (itsType.hasOwnProperty('video')) // felix_share
                        images = itsType['video'];
                    else if (itsType.hasOwnProperty('message')) // Not available
                        body = '<i>' + itsType['message'] + '</i>';
                    else throw new Error("NO CANDIDATE:\n\n" +
                            JSON.stringify(itsType, null, 2));

                    if (images === undefined) break

                    if (!images.hasOwnProperty('image_versions2') ||
                        !images['image_versions2'].hasOwnProperty('candidates'))
                        throw new Error("INVALID CANDIDATE:\n\n" +
                            JSON.stringify(itsType, null, 2));
                    images['image_versions2']['candidates'].forEach((ut) => {
                        let dif = Math.abs(thumbSize - ut.width);
                        if (dif < least) {
                            least = dif;
                            url = ut.url;
                        }
                    });

                    dest = "output/thumbnails/" + it['item_id'] + ".jpg";
                    getFile(url, dest);
                    body = '<img src="' + dest.substr(7) + '" class="card-img-top" alt="">\n';
                    if (images['accessibility_caption'])
                        body += '<span class="card-body">' + images['accessibility_caption'] + '</span>\n';
                    break;
                case 'animated_media':
                    url = it['animated_media']['images']['fixed_height']['url'];
                    body = '<img src="' + url + '" class="animatedMedia" alt="sticker">\n';
                    break;
                case 'like':
                    body = '<i>' + it['like'] + '</i>';
                    break;
                case 'link':
                    let link = it['link']['text'];
                    if (!link.startsWith("http")) link = 'https://' + link;
                    body = '<a href="' + link + '">' + it['link']['text'] + '</a>'
                    break;
                case 'live_viewer_invite':
                    body = '<i>' + it['live_viewer_invite']['message'] + '</i>';
                    break;
                case 'placeholder':
                    body = '<i>' + it['placeholder']['message'] + '</i>';
                    break;
                case 'profile':
                    let user = it['profile']['username'];
                    body = '<a href="https://www.instagram.com/' + user + '">@' + user + '</a>'
                    break;
                case 'raven_media':
                    body = '<i>Raven Media</i>';
                    break;
                case 'reel_share':
                    body = '<i>Reel Share:</i><br>' + it['reel_share']['text'];
                    break;
                case 'video_call_event':
                    body = '<i>' + it['video_call_event']['description'] + '</i>';
                    break;
                case 'voice_media':
                    url = it['voice_media']['media']['audio']['audio_src'];
                    dest = "output/audio/" + it['item_id'] + ".mp4";
                    getFile(url, dest);
                    body = '<audio src="' + dest.substr(7) + '" controls>' +
                        'Audio File => ' + dest + '</audio>\n';
                    break;
                default:
                    throw new Error("UNKNOWN TYPE:\n\n" +
                        JSON.stringify(it, null, 2));
            }
            if (body === undefined) throw new Error("WHAT THE FUCK?!\n\n" +
                JSON.stringify(it, null, 2));

            exported.push({
                "uniq": it['item_id'],
                "type": it['item_type'],
                "from": it['is_sent_by_viewer'],
                "body": body,
                "time": it['timestamp'],
                "card": images !== undefined ? url : undefined,
            });

            if (it['timestamp'] < latest) {
                latest = it['timestamp'];
                latest_id = it['item_id'];
            }
        }
        if (userName === "unknown") {
            userName = j['thread']['users'][0]['username'];
            visName = j['thread']['thread_title'];
        }
        if (j['thread']['has_older'] === true)
            go(thread_id, latest_id)
        else done();
    });
}

let exported = [], userName = "unknown", visName = "Unknown";
const header = (title) => '<!DOCTYPE html>\n' +
    '<html lang="fa">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '  <title>' + title + '</title>\n' +
    '  <style>\n' +
    'body { word-break: break-all; }\n' +
    '@media (prefers-color-scheme: dark) {\n' +
    '    body { background: #222 !important; color: #EEE  !important; }\n' +
    '}\n' +
    '.inBox { cursor: default; }\n' +
    '.inCard { width: 480px; }\n' +
    '.animatedMedia { width: 200px; height: 200px; }\n' +
    '  </style>\n' +
    '  <script src="tools/jquery.js"></script>\n' +
    '  <script src="tools/bootstrap.bundle.min.js"></script>\n' +
    '  <link rel="stylesheet" href="tools/bootstrap.min.css">\n' +
    '  <base target="_blank">\n' +
    '</head>\n' +
    '\n' +
    '<body>\n' +
    '<main class="container border my-3 rounded pt-2 pt-3">\n' +
    '\n';

function getFile(url, dest) {
    if (fs.existsSync(dest)) return;
    fs.writeFile(dest, "", () => {
        let file;
        https.get(url, headers, (res) => {
            if (res.statusCode !== 200) return;
            file = fs.createWriteStream(dest);
            res.pipe(file);
        }).on('error', () => {
        });
        if (file !== undefined) {
            file.on('finish', () => file.close())
            file.on("error", () => file.close());
        }
    });
}

function done() {
    exported = exported.sort((a, b) => a.time - b.time);
    let html = header(visName);
    exported.forEach((it) =>
        html += '<div style="text-align: ' + (it['from'] ? 'right' : 'left') + '">\n' +
            '<p style="text-align: ' + (it['from'] ? 'left' : 'right') + ' !important;" ' +
            'class="inBox d-inline-flex p-2 border rounded-3 mt-1 px-3 btn btn-light' +
            (it.card ? ' card inCard' : '') + '">\n' + it.body + '\n</p>\n</div>\n'
    );
    html += '\n</main>\n</body>\n</html>';
    console.log("Length: " + exported.length);
    fs.writeFile("output/" + userName + ".html", html, () => {
    });
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
rl.question('Enter the THREAD_ID:', id => {
    go(id);
    rl.close();
});
//go("");
