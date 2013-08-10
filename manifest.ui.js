(function($) {

$(document).ready(setup);

function setup() {
    $(document).on("dragover", function(e) {
        e.preventDefault();
    });
    $(document).on("drop", function(e) {
        e.preventDefault();
        $("#container").hide();
        $("#waiting").show();
        var files = e.originalEvent.dataTransfer.files,
            file, reader, data;
        if (files.length > 0) {
            file = files[0];

            if (typeof FileReader !== "undefined") {
                reader = new FileReader();
                reader.onload = function (e) {
                    data = e.target.result;

                    var compdata = {
                        data : new Uint8Array(data),
                        offset : 0,
                        readByte : function() {
                            return this.data[this.offset++];
                        }
                    };
                    
                    var decompdata = {
                        data : [],
                        offset : 0,
                        writeByte : function(value) {
                            this.data[this.offset++] = value;
                        }
                    };
                    try {
                        LZMA.decompressFile(compdata, decompdata);
                    } catch(e) {
                        alert(e);
                        return;
                    }
                    var manifest = Manifest.parse(decompdata.data);

                    displayManifest(file.name, manifest);
                    $("#waiting").hide();
                };
                reader.readAsArrayBuffer(file);

            }
        }
    });
    
    $("#container .manifest-assets").delegate(".asset-file", "click", function(e) {
        if (e.target.tagName == "A") {
            return;
        }
        $(".details", e.currentTarget).toggle();
    });
}

function displayManifest(filename, manifest) {
    $header = $("#container .manifest-header");
    $header.html("");
    
    function addHeaderLine(label, value) {
        $header.append(
            $("<div>").append(
                $("<div>").addClass("label").html(label),
                $("<div>").addClass("value").html(value)
            )
        );
    }
    
    addHeaderLine("File name:", filename);

    if ("name" in manifest) {
        addHeaderLine("Name:", manifest.name);
    }
    if ("version" in manifest) {
        addHeaderLine("Manifest version:", manifest.version);
    }
    if ("provider" in manifest) {
        addHeaderLine("Provider:", manifest.provider);
    }
    if ("providerUrl" in manifest) {
        addHeaderLine("Provider URL:", manifest.providerUrl);
    }
    if ("csUrl" in manifest) {
        addHeaderLine("CS URL:", manifest.csUrl);
    }
    if ("gameUrl" in manifest) {
        addHeaderLine("Game URL:", manifest.gameUrl);
    }
    if ("timestamp" in manifest) {
        addHeaderLine("Date:", manifest.timestamp);
    }
    if ("patchUrl" in manifest) {
        addHeaderLine("Patch URL:", manifest.patchUrl);
    }
    if ("patchServers" in manifest) {
        addHeaderLine("Patch servers:", manifest.patchServers.join("<br>"));
    }
    if ("fileCount" in manifest) {
        addHeaderLine("File count:", manifest.fileCount);
    }
    if ("executable" in manifest) {
        addHeaderLine("Game executable:", manifest.executable);
    }
    if ("launchExecutable" in manifest) {
        addHeaderLine("Launcher executable:", manifest.launchExecutable);
    }
    if ("icon" in manifest) {
        addHeaderLine("Icon:", manifest.icon);
    }
    if ("setupExecutable" in manifest) {
        addHeaderLine("Setup executable:", manifest.setupExecutable);
    }
    if ("includeManifests" in manifest) {
        var $span = $("<span>"),
            url;
        for (var i=0;i<manifest.includeManifests.length;i++) {
            url = manifest.includeManifests[i];
            $span.append($("<a>").attr("href", url).attr("download", "").html(url), $("<br>"));
        }
        addHeaderLine("Include manifests:", $span);
    }
    console.log(manifest);
    $("#container .manifest-assets").html("");
    addAssetFolder(manifest, manifest.assets, "");

    $("#container").show();
}

function toHex(n) {
    var n0 = (n >> 24) & 0xFF,
        n1 = (n >> 16) & 0xFF,
        n2 = (n >> 8) & 0xFF,
        n3 = n & 0xFF;
    n0 = (n0 < 16 ? "0" : "") + n0.toString(16);
    n1 = (n1 < 16 ? "0" : "") + n1.toString(16);
    n2 = (n2 < 16 ? "0" : "") + n2.toString(16);
    n3 = (n3 < 16 ? "0" : "") + n3.toString(16);
    return n0 + n1 + n2 + n3;
}

function makeLink(manifest, file) {
    if (!file.sha) {
        return "";
    }
    var sha = file.sha;
    sha = "/" + sha.substr(0, 2) + "/" + sha.substr(2, 3) + "/" + sha.substr(5);
    return manifest.patchUrl + sha;
}

function addAssetFolder(manifest, assets, folderName) {
    if (!assets) {
        return;
    }
    
    $assets = $("#container .manifest-assets");
    if (assets.name) {
        folderName += assets.name + "/";
    }
    if (assets.folders) {
        for (var i=0;i<assets.folders.length;i++) {
            addAssetFolder(manifest, assets.folders[i], folderName);
        }
    }
    
    if (assets.files) {
        for (var i=0;i<assets.files.length;i++) {
            var file = assets.files[i],
                $details;
            
            var $file = $("<div>").addClass("asset-file");
            if (file.deleted) {
                $file.addClass("deleted");
                $details = "";
            } else {
                $details = $("<div>").addClass("details");

                if ("sizeUncompressed" in file) {
                    $details.append(
                        $("<div>").append(
                            $("<div>").addClass("label").html("Size:"),
                            $("<div>").addClass("value").html(file.sizeUncompressed + " bytes")
                        )
                    );
                }
                if ("sizeCompressed" in file) {
                    $details.append(
                        $("<div>").append(
                            $("<div>").addClass("label").html("Size (compressed):"),
                            $("<div>").addClass("value").html(file.sizeCompressed + " bytes")
                        )
                    );
                }
                if ("timestamp" in file) {
                    $details.append(
                        $("<div>").append(
                            $("<div>").addClass("label").html("Timestamp:"),
                            $("<div>").addClass("value").html(file.timestamp)
                        )
                    );
                }

                if ("crc32" in file) {
                    $details.append(
                        $("<div>").append(
                            $("<div>").addClass("label").html("CRC32:"),
                            $("<div>").addClass("value").html((file.crc32>>>0) + " (0x" + toHex(file.crc32) + ")")
                        )
                    );
                }
                if ("sha" in file) {
                    $details.append(
                        $("<div>").append(
                            $("<div>").addClass("label").html("SHA:"),
                            $("<div>").addClass("value").html(file.sha)
                        )
                    );
                }
                if ("delta" in file) {
                    for (var j=0;j<file.delta.length;j++) {
                        var $delta = $("<div>").addClass("value");
                        var delta = file.delta[j];
                        $delta.append(
                            $("<div>").html("Timestamp: " + delta.timestamp),
                            $("<div>").html("Filesize: " + delta.fileSize + " bytes"),
                            $("<div>").html("CRC32: " + (delta.crc32>>>0) + " (0x" + toHex(delta.crc32) + ")"),
                            $("<div>").html("Range: " + delta.n1 + " - " + delta.n2)
                        );
                        $details.append(
                            $("<div>").append(
                                $("<div>").addClass("label").html("Delta:"),
                                $delta
                            )
                        );
                    }

                }
            }
            
            $file.append(
                $("<div>").addClass("filename").html(folderName + file.name).append(
                    (file.deleted ? "" : $("<div>").addClass("download-link").append(
                        $("<a>")
                            .attr("href", makeLink(manifest, file))
                            .attr("download", file.name + ".soe")
                            .html("&dArr;")
                    ))
                ),
                $details
            );
            $assets.append($file);
        }
    }
}


})(jQuery);