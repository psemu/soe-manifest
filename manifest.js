var Manifest = (function() {


function readUInt8(data, offset) {
    return data[offset];
}

function readUInt32BE(data, offset) {
    return (data[offset] << 24) + (data[offset+1] << 16) + (data[offset+2] << 8) + data[offset + 3];
}

function readUInt24BE(data, offset) {
    return (data[offset] << 16) + (data[offset+1] << 8) + data[offset+2];
}

function readUInt16BE(data, offset) {
    return (data[offset] << 8) + data[offset+1];
}

function parseString(entry) {
    var str = [];
    for (var i=0;i<entry.bytes.length-1;i++) {
        str[i] = String.fromCharCode(entry.bytes[i]);
    }
    return str.join("");
}

function parseArray(entry) {
    return Array.prototype.slice.call(entry.bytes, 0)
}

function parseDate(entry) {
    var t = readUInt32BE(entry.bytes, 0);
    return (new Date(t * 1000)).toUTCString();
}

function parseUInt(entry) {
    if (entry.bytes.length == 4) {
        return readUInt32BE(entry.bytes, 0);
    } else if (entry.bytes.length == 3) {
        return readUInt24BE(entry.bytes, 0);
    } else if (entry.bytes.length == 2) {
        return readUInt16BE(entry.bytes, 0);
    } else if (entry.bytes.length == 1) {
        return entry.bytes[0];
    }
}

function parseHash(entry) {
    var str = "", h;
    for (var i=0;i<entry.bytes.length;i++) {
        h = entry.bytes[i].toString(16);
        if (entry.bytes[i] < 16) {
            h = "0" + h;
        }
        str += h;
    }
    return str;
}

function parseFolder(entry) {
    var entries = parseEntries(entry.bytes, 0);
    var folder = {};
    for (var i=0;i<entries.length;i++) {
        switch (entries[i].type) {
            case 0x01:
                folder.name = parseString(entries[i]);
                break;
            case 0x02:
                folder.folders = folder.folders || [];
                var file = parseFolder(entries[i]);
                folder.folders.push(file);
                break;
            case 0x03:
                folder.files = folder.files || [];
                var file = parseFileEntry(entries[i]);
                folder.files.push(file);
                break;
            case 0x04:
                folder.unknown0x04 = parseUInt(entries[i]);
                break;
            case 0xFE:
                var files = parseFileGroup(entries[i]);
                if (entries[i].entryType == 0x02) {
                    folder.folders = folder.folders || [];
                    folder.folders = folder.folders.concat(files);
                } else if (entries[i].entryType == 0x03) {
                    folder.files = folder.files || [];
                    folder.files = folder.files.concat(files);
                }
                break;
        }
    }
    return folder;
}

function parseFileEntry(entry) {
    var entries = parseEntries(entry.bytes, 0);
    var file = {};
    file.entry = entry;
    for (var i=0;i<entries.length;i++) {
        switch (entries[i].type) {
            case 0x01:
                file.name = parseString(entries[i]);
                break;
            case 0x02:
                file.sizeCompressed = parseUInt(entries[i]);
                break;
            case 0x03:
                file.sizeUncompressed = parseUInt(entries[i]);
                break;
            case 0x04:
                file.crc32 = parseUInt(entries[i]);
                break;
            case 0x06:
                file.deleted = parseUInt(entries[i]);
                break;
            case 0x08:
                file.timestamp = parseDate(entries[i]);
                break;
            case 0x09:
                file.delta = file.delta || [];
                file.delta.push(parseFileDelta(entries[i]));
                break;
            case 0x12:
                file.sha = parseHash(entries[i]);
                break;
            case 0x0A:
                file.unknown0x0A = parseUInt(entries[i]);
                break;
            case 0x0D:
                file.unknown0x0D = parseUInt(entries[i]);
                break;
            case 0x14:
                file.locale = parseString(entries[i]);
                break;
            case 0xFE:
                if (entries[i].entryType == 0x09) {
                    file.delta = file.delta || [];
                    for (var j=0;j<entries[i].entries.length;j++) {
                        file.delta.push(
                            parseFileDelta(entries[i].entries[j])
                        );
                    }
                }
                break;
            default:
                console.log("Unknown entry type in file entry: " + entries[i].type, entries[i]);
        }
    }
    return file;
}

function parseFileDelta(entry) {
    var delta = {};
    var deltaData = parseEntries(entry.bytes, 0);
    for (var i=0;i<deltaData.length;i++) {
        switch (deltaData[i].type) {
            case 0x01:
                delta.fileSize = parseUInt(deltaData[i]);
                break;
            case 0x02:
                delta.crc32 = parseUInt(deltaData[i]);
                break;
            case 0x03:
                delta.n1 = parseUInt(deltaData[i]);
                break;
            case 0x04:
                delta.timestamp = parseDate(deltaData[i]);
                break;
            /*
            case 0x05:
                delta.timestamp2 = parseDate(deltaData[i]);
                break;
            */
            case 0x08:
                delta.n2 = parseUInt(deltaData[i]);
                break;
            default:
                console.log("Unknown entry type in file delta entry: " + deltaData[i].type);
        }
    }
    return delta;
}

function parseFileGroup(entry) {
    var entries = entry.entries;
    var files = [];
    for (var i=0;i<entries.length;i++) {
        switch (entries[i].type) {
            case 0x02:
                var folder = parseFolder(entries[i]);
                files.push(folder);
                break;
            case 0x03:
                var file = parseFileEntry(entries[i]);
                files.push(file);
                break;
        }
    }
    return files;
}

function parseManifest(data) {
    var manifest = {},
        entries = parseEntries(data);

    for (var i=0;i<entries.length;i++) {
        var entry = entries[i];
        switch (entries[i].type) {
            case 0x01:
                manifest.version = readUInt8(entry.bytes, 0);
                break;
            case 0x02:
                manifest.assets = parseFolder(entry);
                break;
            case 0x03:
                manifest.name = parseString(entry);
                break;
            case 0x05:
                manifest.url = parseString(entry);
                break;
            case 0x06:
                manifest.provider = parseString(entry);
                break;
            case 0x07:
                manifest.providerUrl = parseString(entry);
                break;
            case 0x0A:
                manifest.csUrl = parseString(entry);
                break;
            case 0x0B:
                manifest.gameUrl = parseString(entry);
                break;
            case 0x0D:
                manifest.launchExecutable = parseString(entry);
                break;
            case 0x0F:
                manifest.icon = parseString(entry);
                break;
            case 0x11:
                manifest.unknown0x11 = parseUInt(entry);
                break;
            case 0x12:
                manifest.unknown0x12 = parseUInt(entry);
                break;
            case 0x15:
                manifest.unknown0x15 = parseUInt(entry);
                break;
            case 0x1A:
                manifest.unknown0x1A = parseUInt(entry);
                break;
            case 0x1B:
                manifest.fileCount = parseUInt(entry);
                break;
            case 0x1C:
                manifest.executable = parseString(entry);
                break;
            case 0x21:
                manifest.patchName = parseString(entry);
                break;
            case 0x22:
                manifest.setupExecutable = parseString(entry);
                break;
            case 0x28:
                manifest.patchUrl = parseString(entry);
                break;
            case 0x29:
                manifest.timestamp = parseDate(entry);
                break;
            case 0x2B:
                manifest.locales = parseString(entry);
                break;
            case 0x2C:
                manifest.unknown0x2C = parseUInt(entry);
                break;
            case 0x26:
                manifest.includeManifests = manifest.includeManifests || [];
                manifest.includeManifests.push(parseString(parseEntry(entry.bytes, 0)));
                break;
            case 0xFE: 
                switch (entry.entryType) {
                    case 0x25:
                        manifest.patchServers = [];
                        for (var j=0;j<entry.entries.length;j++) {
                            var subEntry = entry.entries[j];
                            var serverEntry = parseEntry(subEntry.bytes, 0);
                            manifest.patchServers.push(
                                parseString(serverEntry)
                            );
                        }
                        break;
                    case 0x26:
                        manifest.includeManifests = manifest.includeManifests || [];
                        for (var j=0;j<entry.entries.length;j++) {
                            var subEntry = entry.entries[j];
                            manifest.includeManifests.push(parseString(parseEntry(subEntry.bytes, 0)));
                        }
                        break;
                }
                break;
            default:
                console.log("Unknown entry in manifest: " + entries[i].type + " @ " + entries[i].offset);
        }
    }
    return manifest;
}

function parseEntries(data, offset) {
    var offset = 0,
        entry,
        entries = [];
    while (offset < data.length) {
        try {
            var entry = parseEntry(data, offset);
            entries.push(entry);
            offset += entry.length;
        } catch(e) {
            console.log("Cannot parse entry at offset: " + offset);
            break;
        }
    }
    return entries;
}

function parseEntry(data, offset) {
    var type = readUInt8(data, offset),
        length, bytes, entryLength, dataStart,

    length = readUInt8(data, offset+1);
    
    if (length >= 128) {
        if (length == 0xFF) {
            length = readUInt32BE(data, offset+2);
            dataStart = offset + 2 + 4;
            entryLength = length + 2 + 4;
        } else {
            length = (length - 128) * 256 + readUInt8(data, offset+2);
            dataStart = offset + 2 + 1;
            entryLength = length + 2 + 1;
        }
    } else {
        dataStart = offset + 2;
        entryLength = length + 2;
    }
    
    bytes = data.slice(dataStart, dataStart+length);
    
    var entry = {
        offset : offset
    };
    
    if (type == 0xFE) {
        var numEntries = readUInt8(bytes, 2),
            entryType = readUInt8(bytes, 0),
            subEntries = [], 
            subEntry, i;
        offset = dataStart + length;
        for (i=0;i<numEntries;i++) {
            subEntry = parseEntry(data, offset);
            offset += subEntry.length;
            entryLength += subEntry.length;
            subEntries.push(subEntry);
        }
        entry.type = type;
        entry.entryType = entryType;
        entry.length = entryLength;
        entry.entries = subEntries;
        entry.bytes = bytes;
    } else {
        entry.type = type;
        entry.length = entryLength;
        entry.bytes = bytes;
    }
    return entry;
}

return {
    parse: parseManifest
};

})();