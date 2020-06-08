var YOUGET_BIN = "you-get";
var COOKIE_FILE = "E:/tmp/cookies.txt";
var NO_INITIAL_AUDIO_SYNC = true;

if (!String.prototype.startsWith) {
    String.prototype.startsWith = function (searchString, position) {
        position = position || 0;
        return this.indexOf(searchString, position) === position;
    };
}

function reset_http_header(key, value) {
    headers = mp.get_property_native("http-header-fields");
    for (var i = 0; i < headers.length; ++i) {
        var header = headers[i];
        var headerKey = header.split(":", 1);
        if (headerKey == key) {
            headers[i] = key + ": " + value;
            mp.set_property_native("http-header-fields", headers);
            return;
        }
    }
    headers.push(key + ": " + value);
    mp.set_property_native("http-header-fields", headers);
}

function get_bilibili_streams(video_url) {
    var args = [YOUGET_BIN, "--cookies", COOKIE_FILE, "--json", video_url];
    var process = mp.command_native({
        name: "subprocess",
        args: args,
        playback_only: false,
        capture_stdout: true
    });

    if (process.error || process.status != 0) {
        mp.msg.error("There was an error executing you-get:");
        mp.msg.error("  Status: " + process.status);
        mp.msg.error("  Error: " + process.error);
        mp.msg.error("  stdout: " + process.stdout);
        mp.msg.error("args: " + args);
    }

    return JSON.parse(process.stdout);
}

mp.add_hook("on_load", 9, function () {
    var validPrefixes = [
        "https://www.bilibili.com/video/",
        "https://www.bilibili.com/bangumi/play/",
    ];
    var streamOrder = ["dash-hdflv2", "dash-flv", "flv", "dash-flv720", "mp4", "dash-flv480", "dash-flv360"];

    var originalUrl = mp.get_property_native("stream-open-filename");
    if (!originalUrl) {
        return;
    }

    var isBilibiliUrl = false;
    for (var i = 0; i < validPrefixes.length; ++i) {
        if (originalUrl.startsWith(validPrefixes[i])) {
            isBilibiliUrl = true;
        }
    }

    if (!isBilibiliUrl) {
        return;
    }

    mp.command_native({ name: "show-text", text: "Got Bilibili URL: " + originalUrl + "\n Loading.....", duration: 2000 });
    // disable youtube-dl
    mp.set_property_native("no-ytdl", true);
    mp.set_property_native('ytdl', false);

    var result = get_bilibili_streams(originalUrl)

    var selectedStream = null;
    for (var i = 0; i < streamOrder.length; ++i) {
        var streamName = streamOrder[i];
        var stream = result.streams[streamName];
        if (stream == undefined) {
            continue;
        }
        selectedStream = stream;
        break;
    }

    if (selectedStream == null) {
        mp.msg.error("Cannot select stream to play.");
        dump(result);
        return;
    }

    reset_http_header("referer", result.extra.referer);
    reset_http_header("user-agent", result.extra.ua);

    if (NO_INITIAL_AUDIO_SYNC) {
        mp.set_property_native("initial-audio-sync", false);
        mp.set_property_native("no-initial-audio-sync", true);
    }
    mp.set_property_native("media-title", result.title + " [" + stream.quality + "]");

    var videoFile = stream.src[0];
    if (videoFile instanceof Array) {
        if (videoFile.length != 1) {
            mp.msg.error("More than one video streams found, playing only the first one.");
        }
        videoFile = videoFile[0];
    }
    mp.set_property_native("stream-open-filename", videoFile);
    
    if (stream.src.length == 2) {
        var audioFiles = stream.src[1];
        if (audioFiles instanceof String) {
            audioFiles = [audioFiles];
        }
        mp.set_property_native("audio-files", audioFiles);
    }
});
